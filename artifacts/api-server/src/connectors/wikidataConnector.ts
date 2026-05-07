import { createHash } from "node:crypto";
import type { Business, InsertBusiness, InsertBusinessSource } from "@workspace/db";
import type { EnrichmentConnector, EnrichmentConnectorResult } from "./types";
import { logger } from "../lib/logger";
import { CACHE_TTLS, enrichmentCache } from "../services/enrichmentCacheService";
import { enrichmentRateLimiter, getRetryDelayMs, sleep } from "../services/enrichmentRateLimiterService";
import { normalizeWebsite } from "../services/businessNormalization";

const WIKIDATA_SPARQL_URL = "https://query.wikidata.org/sparql";
const WIKIDATA_RATE_LIMIT = {
  bucket: "wikidata",
  maxRequests: 8,
  intervalMs: 60_000,
  concurrency: 1,
};
const DEFAULT_USER_AGENT =
  "StreetLevelDiscovery/1.0 (https://github.com/TheAche77/File-Management-Toolss)";

interface WikidataBindingValue {
  value: string;
  type?: string;
}

interface WikidataBinding {
  item?: WikidataBindingValue;
  itemLabel?: WikidataBindingValue;
  itemDescription?: WikidataBindingValue;
  website?: WikidataBindingValue;
  coord?: WikidataBindingValue;
  phone?: WikidataBindingValue;
}

interface WikidataResponse {
  results?: {
    bindings?: WikidataBinding[];
  };
}

interface Candidate {
  id: string;
  url: string;
  label: string | null;
  description: string | null;
  website: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  distanceMeters: number | null;
}

function hashPayload(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function normalizeSparqlLabel(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, " ");
}

function escapeSparqlString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function extractWikidataId(itemUrl: string): string {
  return itemUrl.split("/").pop() ?? itemUrl;
}

function parseWktPoint(value: string): { latitude: number; longitude: number } | null {
  const match = /^Point\(([-\d.]+) ([-\d.]+)\)$/i.exec(value.trim());
  if (!match) return null;
  const longitude = Number(match[1]);
  const latitude = Number(match[2]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

function distanceMeters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const earthRadius = 6_371_000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(h));
}

function toRad(value: number) {
  return (value * Math.PI) / 180;
}

function buildSearchQuery(business: Business): string {
  const exactName = escapeSparqlString(normalizeSparqlLabel(business.name));
  return `
SELECT ?item ?itemLabel ?itemDescription ?website ?coord ?phone WHERE {
  ?item rdfs:label ?label.
  FILTER(LANG(?label) IN ("en", "it", "fr", "es", "de", "nl", "pt"))
  FILTER(LCASE(STR(?label)) = "${exactName}")
  OPTIONAL { ?item wdt:P856 ?website. }
  OPTIONAL { ?item wdt:P625 ?coord. }
  OPTIONAL { ?item wdt:P1329 ?phone. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,it,fr,es,de,nl,pt". }
}
LIMIT 10`;
}

function buildIdQuery(wikidataId: string): string {
  const id = wikidataId.replace(/[^Q\d]/g, "");
  return `
SELECT ?item ?itemLabel ?itemDescription ?website ?coord ?phone WHERE {
  BIND(wd:${id} AS ?item)
  OPTIONAL { ?item wdt:P856 ?website. }
  OPTIONAL { ?item wdt:P625 ?coord. }
  OPTIONAL { ?item wdt:P1329 ?phone. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,it,fr,es,de,nl,pt". }
}
LIMIT 1`;
}

function mapBindings(bindings: WikidataBinding[], business: Business): Candidate[] {
  const businessPoint = {
    latitude: Number(business.latitude),
    longitude: Number(business.longitude),
  };

  return bindings
    .map((binding) => {
      const itemUrl = binding.item?.value;
      if (!itemUrl) return null;
      const parsedPoint = binding.coord?.value ? parseWktPoint(binding.coord.value) : null;
      const candidate: Candidate = {
        id: extractWikidataId(itemUrl),
        url: itemUrl,
        label: binding.itemLabel?.value ?? null,
        description: binding.itemDescription?.value ?? null,
        website: normalizeWebsite(binding.website?.value ?? null),
        phone: binding.phone?.value ?? null,
        latitude: parsedPoint?.latitude ?? null,
        longitude: parsedPoint?.longitude ?? null,
        distanceMeters:
          parsedPoint && Number.isFinite(businessPoint.latitude) && Number.isFinite(businessPoint.longitude)
            ? Math.round(distanceMeters(businessPoint, parsedPoint))
            : null,
      };
      return candidate;
    })
    .filter((candidate): candidate is Candidate => Boolean(candidate));
}

function chooseCandidate(candidates: Candidate[], business: Business): Candidate | null {
  if (candidates.length === 0) return null;
  const businessName = normalizeName(business.name);
  const website = normalizeWebsite(business.website);

  const scored = candidates.map((candidate) => {
    let score = 0;
    if (candidate.label && normalizeName(candidate.label) === businessName) score += 40;
    if (website && candidate.website && website === candidate.website) score += 45;
    if (candidate.distanceMeters !== null && candidate.distanceMeters <= 500) score += 35;
    else if (candidate.distanceMeters !== null && candidate.distanceMeters <= 2000) score += 20;
    if (candidate.description) score += 5;
    return { candidate, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best || best.score < 40) return null;
  return best.candidate;
}

function buildSourceRecord(businessId: number, candidate: Candidate, sourceHash: string): InsertBusinessSource {
  return {
    businessId,
    sourceType: "wikidata_entity",
    sourceUrl: candidate.url,
    sourceDomain: "wikidata.org",
    discoveredVia: "wikidata_enrichment",
    fetchStatus: "fetched",
    lastFetchedAt: new Date(),
    contentHash: sourceHash,
    sourcePayloadSummary: [
      candidate.label ? `label=${candidate.label}` : null,
      candidate.description ? `description=${candidate.description}` : null,
      candidate.website ? `website=${candidate.website}` : null,
      candidate.distanceMeters !== null ? `distance_m=${candidate.distanceMeters}` : null,
    ].filter(Boolean).join("; "),
    sourceLicense: "CC0 1.0",
    sourceAttribution: "Wikidata contributors",
    sourceRateLimitBucket: WIKIDATA_RATE_LIMIT.bucket,
    httpStatus: 200,
    isOfficial: false,
    sourcePriority: 70,
    usefulnessScore: 80,
    nextFetchAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    freshnessStatus: "fresh",
  };
}

export class WikidataConnector implements EnrichmentConnector {
  name = "wikidata";

  isAvailable(): boolean {
    return process.env["ENABLE_WIKIDATA_ENRICHMENT"] !== "false";
  }

  getRateLimitMetadata() {
    return WIKIDATA_RATE_LIMIT;
  }

  async enrichBusiness(business: Business): Promise<EnrichmentConnectorResult> {
    const startedAt = Date.now();
    const errors: string[] = [];

    if (!business.name) {
      return this.buildResult(business.id, "skipped", {}, [], errors, null, startedAt);
    }

    try {
      const query = business.wikidataId ? buildIdQuery(business.wikidataId) : buildSearchQuery(business);
      const cacheKey = `wikidata::${hashPayload({ query })}`;
      const negativeKey = `${cacheKey}::miss`;

      if (enrichmentCache.hasFresh(negativeKey)) {
        return this.buildResult(business.id, "miss", {}, [], errors, null, startedAt);
      }

      const data =
        enrichmentCache.get<WikidataResponse>(cacheKey) ??
        await enrichmentRateLimiter.schedule(WIKIDATA_RATE_LIMIT, () => this.fetchQuery(query));

      enrichmentCache.set(cacheKey, data, CACHE_TTLS.apiResponse);
      const candidates = mapBindings(data.results?.bindings ?? [], business);
      const candidate = chooseCandidate(candidates, business);

      if (!candidate) {
        enrichmentCache.set(negativeKey, true, CACHE_TTLS.negativeLookup);
        return this.buildResult(business.id, "miss", {}, [], errors, hashPayload(data), startedAt);
      }

      const sourceHash = hashPayload(candidate);
      const patch: Partial<InsertBusiness> = {
        wikidataId: candidate.id,
        website: business.website ?? candidate.website,
        phone: business.phone ?? candidate.phone,
        hasWebsite: Boolean(business.website ?? candidate.website),
        hasPhone: Boolean(business.phone ?? candidate.phone),
      };

      return this.buildResult(
        business.id,
        business.wikidataId === candidate.id && business.website === patch.website && business.phone === patch.phone
          ? "unchanged"
          : "enriched",
        patch,
        [buildSourceRecord(business.id, candidate, sourceHash)],
        errors,
        sourceHash,
        startedAt,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(message);
      logger.warn({ err, businessId: business.id }, "Wikidata enrichment failed");
      return this.buildResult(business.id, "failed", {}, [], errors, null, startedAt);
    }
  }

  private async fetchQuery(query: string): Promise<WikidataResponse> {
    const userAgent = process.env["SLG_USER_AGENT"] || DEFAULT_USER_AGENT;

    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await fetch(WIKIDATA_SPARQL_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/sparql-query",
          "Accept": "application/sparql-results+json",
          "User-Agent": userAgent,
          "Api-User-Agent": userAgent,
        },
        body: query,
      });

      if (response.ok) {
        return await response.json() as WikidataResponse;
      }

      if (response.status === 429 || response.status >= 500) {
        await sleep(getRetryDelayMs(response, attempt));
        continue;
      }

      throw new Error(`Wikidata ${response.status}: ${response.statusText}`);
    }

    throw new Error("Wikidata request failed after retries");
  }

  private buildResult(
    businessId: number,
    status: EnrichmentConnectorResult["status"],
    patch: Partial<InsertBusiness>,
    sourceRecords: InsertBusinessSource[],
    errors: string[],
    sourceHash: string | null,
    startedAt: number,
  ): EnrichmentConnectorResult {
    return {
      businessId,
      source: this.name,
      status,
      patch,
      sourceRecords,
      errors,
      sourceHash,
      latencyMs: Date.now() - startedAt,
    };
  }
}
