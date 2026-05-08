import { createHash } from "node:crypto";
import { asc, desc, sql } from "drizzle-orm";
import {
  db,
  geoCitiesTable,
  type Business,
  type GeoCity,
  type InsertBusiness,
  type InsertBusinessSource,
} from "@workspace/db";
import type { EnrichmentConnector, EnrichmentConnectorResult } from "./types";
import { normalizeGeoNameKey, resolveCountryCode } from "../services/geonamesMockService";

const GEONAMES_RATE_LIMIT = {
  bucket: "local_dump",
  maxRequests: 10_000,
  intervalMs: 1000,
  concurrency: 1,
};

function hashPayload(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function toNumber(value: string | number | null | undefined): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function countryCodeForBusiness(business: Business): string | null {
  return (
    resolveCountryCode(business.country) ??
    resolveCountryCode(business.targetMarket) ??
    resolveCountryCode(business.city)
  );
}

function distanceExpression(business: Business) {
  const latitude = toNumber(business.latitude);
  const longitude = toNumber(business.longitude);
  if (latitude === null || longitude === null) return null;

  return sql<number>`
    (
      power((${geoCitiesTable.latitude}::double precision - ${latitude}), 2) +
      power((${geoCitiesTable.longitude}::double precision - ${longitude}), 2)
    )
  `;
}

async function lookupGeoCity(business: Business): Promise<GeoCity | null> {
  if (!business.city) return null;
  const countryCode = countryCodeForBusiness(business);
  if (!countryCode) return null;

  const normalizedName = normalizeGeoNameKey(business.city);
  if (!normalizedName) return null;

  const distance = distanceExpression(business);
  const orderBy = distance
    ? [asc(distance), desc(geoCitiesTable.population)]
    : [desc(geoCitiesTable.population)];

  const rows = await db
    .select()
    .from(geoCitiesTable)
    .where(
      sql`${geoCitiesTable.countryCode} = ${countryCode} AND ${geoCitiesTable.normalizedName} = ${normalizedName}`,
    )
    .orderBy(...orderBy)
    .limit(1);

  if (rows[0]) return rows[0];

  const alternateRows = await db
    .select()
    .from(geoCitiesTable)
    .where(
      sql`
        ${geoCitiesTable.countryCode} = ${countryCode}
        AND ${geoCitiesTable.alternateNames} IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM unnest(string_to_array(${geoCitiesTable.alternateNames}, ',')) AS alternate_name
          WHERE lower(trim(alternate_name)) = ${business.city.toLowerCase().trim()}
        )
      `,
    )
    .orderBy(...orderBy)
    .limit(1);

  return alternateRows[0] ?? null;
}

function buildSourceRecord(businessId: number, city: GeoCity, sourceHash: string): InsertBusinessSource {
  return {
    businessId,
    sourceType: "geonames_record",
    sourceUrl: `https://www.geonames.org/${city.geonameId}`,
    sourceDomain: "geonames.org",
    discoveredVia: "geonames_enrichment",
    fetchStatus: "fetched",
    lastFetchedAt: new Date(),
    contentHash: sourceHash,
    sourcePayloadSummary: [
      `name=${city.name}`,
      `asciiName=${city.asciiName}`,
      `countryCode=${city.countryCode}`,
      city.population !== null ? `population=${city.population}` : null,
      city.timezone ? `timezone=${city.timezone}` : null,
    ].filter(Boolean).join("; "),
    sourceLicense: "CC BY 4.0",
    sourceAttribution: "GeoNames",
    sourceRateLimitBucket: GEONAMES_RATE_LIMIT.bucket,
    httpStatus: 200,
    isOfficial: false,
    sourcePriority: 55,
    usefulnessScore: 90,
    nextFetchAt: null,
    freshnessStatus: "fresh",
  };
}

export class GeoNamesConnector implements EnrichmentConnector {
  name = "geonames";

  isAvailable(): boolean {
    return true;
  }

  getRateLimitMetadata() {
    return GEONAMES_RATE_LIMIT;
  }

  async enrichBusiness(business: Business): Promise<EnrichmentConnectorResult> {
    const startedAt = Date.now();
    const errors: string[] = [];

    if (!business.city || !countryCodeForBusiness(business)) {
      return this.buildResult(business.id, "skipped", {}, [], errors, null, startedAt);
    }

    try {
      const city = await lookupGeoCity(business);
      if (!city) {
        return this.buildResult(business.id, "miss", {}, [], errors, null, startedAt);
      }

      const sourceHash = hashPayload(city);
      const geonamesId = String(city.geonameId);
      const patch: Partial<InsertBusiness> = {
        geonamesId,
      };

      return this.buildResult(
        business.id,
        business.geonamesId === geonamesId ? "unchanged" : "enriched",
        patch,
        [buildSourceRecord(business.id, city, sourceHash)],
        errors,
        sourceHash,
        startedAt,
      );
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
      return this.buildResult(business.id, "failed", {}, [], errors, null, startedAt);
    }
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
