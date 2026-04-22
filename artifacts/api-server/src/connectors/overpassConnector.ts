import type { Connector, ConnectorOptions, ConnectorResult } from "./types";
import { resolveBbox, resolveCityProfile } from "./types";
import type { InsertBusiness } from "@workspace/db";
import { logger } from "../lib/logger";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const TIMEOUT_MS = 30000;
const MAX_RETRIES = 3;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
}

function buildQuery(osmTags: string, bbox: { south: number; west: number; north: number; east: number }): string {
  const { south, west, north, east } = bbox;
  const bboxStr = `(${south},${west},${north},${east})`;
  const pairs = osmTags.split("|").map((tag) => {
    const [k, v] = tag.split("=");
    return { k: k!.trim(), v: v!.trim() };
  });

  const lines: string[] = [];
  for (const { k, v } of pairs) {
    lines.push(`  node["${k}"="${v}"]${bboxStr};`);
    lines.push(`  way["${k}"="${v}"]${bboxStr};`);
    lines.push(`  relation["${k}"="${v}"]${bboxStr};`);
  }

  return `[out:json][timeout:25];\n(\n${lines.join("\n")}\n);\nout center;`;
}

function buildAddressLine(tags: Record<string, string>): string | null {
  const street = tags["addr:street"];
  const number = tags["addr:housenumber"];
  if (street && number) return `${street} ${number}`;
  if (street) return street;
  return null;
}

function extractWebsite(tags: Record<string, string>): string | null {
  return tags["website"] ?? tags["contact:website"] ?? null;
}

function extractPhone(tags: Record<string, string>): string | null {
  return tags["phone"] ?? tags["contact:phone"] ?? null;
}

function extractCountry(
  tags: Record<string, string>,
  fallbackCity: string,
): string | null {
  return (
    tags["addr:country"] ??
    tags["contact:country"] ??
    resolveCityProfile(fallbackCity)?.country ??
    null
  );
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export class OverpassConnector implements Connector {
  name = "osm";

  isAvailable(): boolean {
    return true;
  }

  async fetch(options: ConnectorOptions): Promise<ConnectorResult> {
    const bbox = options.bbox ?? resolveBbox(options.city);
    const locationProfile = resolveCityProfile(options.city);
    const query = buildQuery(options.osmTags, bbox);
    const errors: string[] = [];

    let elements: Array<{ type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }> = [];

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

        const response = await fetch(OVERPASS_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "LocalBusinessDiscovery/1.0",
            "Accept": "application/json",
          },
          body: `data=${encodeURIComponent(query)}`,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Overpass ${response.status}: ${response.statusText}`);
        }
        const data = await response.json() as { elements: typeof elements };
        elements = data.elements;
        logger.info({ count: elements.length, category: options.categorySlug, city: options.city }, "Overpass fetch done");
        break;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(msg);
        logger.warn({ attempt, err: msg }, "Overpass fetch failed");
        if (attempt < MAX_RETRIES) await sleep(2000 * attempt);
      }
    }

    if (elements.length === 0 && errors.length > 0) {
      return { items: [], source: "osm", errors };
    }

    const usedSlugs = new Set<string>();
    const items: InsertBusiness[] = [];

    for (const el of elements) {
      const tags = el.tags ?? {};
      const name = tags["name"];
      if (!name) continue;

      const lat = el.lat ?? el.center?.lat;
      const lon = el.lon ?? el.center?.lon;
      if (lat === undefined || lon === undefined) continue;

      const website = extractWebsite(tags);
      const phone = extractPhone(tags);

      let baseSlug = slugify(name) || `biz-${el.id}`;
      let slug = baseSlug;
      let counter = 1;
      while (usedSlugs.has(slug)) { slug = `${baseSlug}-${counter++}`; }
      usedSlugs.add(slug);

      items.push({
        categorySlug: options.categorySlug,
        name,
        slug,
        latitude: String(lat),
        longitude: String(lon),
        addressLine: buildAddressLine(tags),
        city: tags["addr:city"] ?? locationProfile?.canonicalCity ?? options.city,
        postalCode: tags["addr:postcode"] ?? null,
        region: tags["addr:state"] ?? null,
        country: extractCountry(tags, options.city),
        website,
        phone,
        osmId: String(el.id),
        osmType: el.type,
        hasWebsite: !!website,
        hasPhone: !!phone,
        enrichmentStatus: "pending",
      });
    }

    return { items, source: "osm", errors };
  }
}
