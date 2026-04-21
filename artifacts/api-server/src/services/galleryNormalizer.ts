import type { OverpassElement } from "./overpassService";
import type { InsertGallery } from "@workspace/db";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
}

function makeUniqueSlug(base: string, existing: Set<string>): string {
  let slug = base;
  let counter = 1;
  while (existing.has(slug)) {
    slug = `${base}-${counter}`;
    counter++;
  }
  existing.add(slug);
  return slug;
}

function buildAddressLine(tags: Record<string, string>): string | null {
  const parts: string[] = [];
  const street = tags["addr:street"];
  const number = tags["addr:housenumber"];
  if (street && number) {
    parts.push(`${street} ${number}`);
  } else if (street) {
    parts.push(street);
  }
  return parts.length > 0 ? parts.join(", ") : null;
}

function extractWebsite(tags: Record<string, string>): string | null {
  return tags["website"] ?? tags["contact:website"] ?? null;
}

function extractPhone(tags: Record<string, string>): string | null {
  return tags["phone"] ?? tags["contact:phone"] ?? null;
}

export function normalizeElement(
  element: OverpassElement,
  usedSlugs: Set<string>,
): InsertGallery | null {
  const tags = element.tags ?? {};
  const name = tags["name"];
  if (!name) return null;

  const lat =
    element.lat ?? element.center?.lat;
  const lon =
    element.lon ?? element.center?.lon;
  if (lat === undefined || lon === undefined) return null;

  const website = extractWebsite(tags);
  const phone = extractPhone(tags);
  const baseSlug = slugify(name);
  const slug = makeUniqueSlug(
    baseSlug || `gallery-${element.id}`,
    usedSlugs,
  );

  return {
    name,
    slug,
    latitude: String(lat),
    longitude: String(lon),
    addressLine: buildAddressLine(tags),
    city: tags["addr:city"] ?? "Rome",
    postalCode: tags["addr:postcode"] ?? null,
    region: "Lazio",
    country: "Italy",
    website,
    phone,
    sourcePrimary: "osm",
    osmId: String(element.id),
    osmType: element.type,
    hasWebsite: !!website,
    hasPhone: !!phone,
    enrichmentStatus: "pending",
  };
}

export function normalizeElements(
  elements: OverpassElement[],
): InsertGallery[] {
  const usedSlugs = new Set<string>();
  const results: InsertGallery[] = [];
  for (const el of elements) {
    const normalized = normalizeElement(el, usedSlugs);
    if (normalized) results.push(normalized);
  }
  return results;
}
