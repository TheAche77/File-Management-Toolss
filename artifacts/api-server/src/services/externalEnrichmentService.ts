import { and, asc, eq, isNull, or, sql } from "drizzle-orm";
import {
  businessesTable,
  businessSourcesTable,
  db,
  type Business,
  type InsertBusiness,
} from "@workspace/db";
import type { EnrichmentConnector, EnrichmentConnectorResult } from "../connectors/types";
import { WikidataConnector } from "../connectors/wikidataConnector";
import { logger } from "../lib/logger";
import { computeEnrichmentStatus } from "./businessNormalization";
import { upsertBusinessSources } from "./businessSourceService";
import { refreshBusinessResearchStates } from "./businessResearchPersistenceService";

export interface EnrichmentRunOptions {
  source?: string;
  limit?: number;
  businessId?: number;
}

export interface EnrichmentRunStats {
  source: string;
  scanned: number;
  enriched: number;
  unchanged: number;
  missed: number;
  failed: number;
  skipped: number;
  errors: string[];
  latencyMs: number;
}

const connectors: EnrichmentConnector[] = [new WikidataConnector()];

function clampLimit(limit: number | undefined) {
  if (!limit || !Number.isFinite(limit)) return 25;
  return Math.min(250, Math.max(1, Math.floor(limit)));
}

function availableConnectors(source?: string) {
  return connectors.filter((connector) => connector.isAvailable() && (!source || connector.name === source));
}

function calculateDataQualityScore(business: Business, patch: Partial<InsertBusiness>, sourceCount: number) {
  let score = 0;
  if (business.website || patch.website) score += 20;
  if (business.phone || patch.phone) score += 15;
  if (business.osmId) score += 15;
  if (business.wikidataId || patch.wikidataId) score += 20;
  if (business.geonamesId || patch.geonamesId) score += 10;
  if (sourceCount >= 2) score += 10;
  return Math.min(100, score);
}

async function countSources(businessId: number) {
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(businessSourcesTable)
    .where(eq(businessSourcesTable.businessId, businessId));
  return Number(rows[0]?.count ?? 0);
}

async function selectBusinesses(options: EnrichmentRunOptions) {
  if (options.businessId) {
    return db
      .select()
      .from(businessesTable)
      .where(eq(businessesTable.id, options.businessId))
      .limit(1);
  }

  return db
    .select()
    .from(businessesTable)
    .where(
      and(
        or(
          eq(businessesTable.enrichmentStatus, "pending"),
          eq(businessesTable.enrichmentStatus, "partially_enriched"),
          isNull(businessesTable.wikidataId),
        ),
        or(
          isNull(businessesTable.lastEnrichmentAt),
          sql`${businessesTable.lastEnrichmentAt} < now() - interval '7 days'`,
        ),
      ),
    )
    .orderBy(
      asc(sql`coalesce(${businessesTable.lastEnrichmentAt}, ${businessesTable.createdAt})`),
      asc(businessesTable.id),
    )
    .limit(clampLimit(options.limit));
}

async function applyEnrichmentResult(business: Business, result: EnrichmentConnectorResult) {
  if (result.sourceRecords.length > 0) {
    await upsertBusinessSources(result.sourceRecords);
  }

  const sourceCount = await countSources(business.id);
  const dataQualityScore = calculateDataQualityScore(business, result.patch, sourceCount);

  if (result.status !== "enriched" && result.status !== "unchanged") {
    if (result.status === "failed") {
      await db
        .update(businessesTable)
        .set({
          enrichmentStatus: "failed",
          failedSourceCount: sql`coalesce(${businessesTable.failedSourceCount}, 0) + 1`,
          dataQualityScore,
          enrichmentSourceCount: sourceCount,
          lastEnrichmentAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(businessesTable.id, business.id));
    }
    if (result.status === "miss" || result.status === "skipped") {
      await db
        .update(businessesTable)
        .set({
          dataQualityScore,
          enrichmentSourceCount: sourceCount,
          lastEnrichmentAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(businessesTable.id, business.id));
    }
    return;
  }

  const nextValues: Partial<InsertBusiness> = {
    ...result.patch,
    enrichmentStatus: computeEnrichmentStatus({
      website: result.patch.website ?? business.website,
      phone: result.patch.phone ?? business.phone,
      googlePlaceId: business.googlePlaceId,
      googleMapsUrl: business.googleMapsUrl,
      rating: business.rating,
      userRatingsTotal: business.userRatingsTotal,
    }),
    dataQualityScore,
    enrichmentSourceCount: sourceCount,
    lastEnrichmentAt: new Date(),
    lastCheckedAt: new Date(),
  };

  await db
    .update(businessesTable)
    .set({
      ...nextValues,
      updatedAt: new Date(),
    })
    .where(eq(businessesTable.id, business.id));
}

export async function runExternalEnrichment(options: EnrichmentRunOptions = {}): Promise<EnrichmentRunStats[]> {
  const selectedConnectors = availableConnectors(options.source);
  if (selectedConnectors.length === 0) {
    return [
      {
        source: options.source ?? "none",
        scanned: 0,
        enriched: 0,
        unchanged: 0,
        missed: 0,
        failed: 0,
        skipped: 0,
        errors: [`No available connector${options.source ? ` for ${options.source}` : ""}`],
        latencyMs: 0,
      },
    ];
  }

  const businesses = await selectBusinesses(options);
  const refreshedIds = new Set<number>();

  const statsBySource = new Map<string, EnrichmentRunStats>(
    selectedConnectors.map((connector) => [
      connector.name,
      {
        source: connector.name,
        scanned: 0,
        enriched: 0,
        unchanged: 0,
        missed: 0,
        failed: 0,
        skipped: 0,
        errors: [],
        latencyMs: 0,
      },
    ]),
  );

  for (const business of businesses) {
    for (const connector of selectedConnectors) {
      const stats = statsBySource.get(connector.name)!;
      stats.scanned += 1;
      const result = await connector.enrichBusiness(business);
      stats.latencyMs += result.latencyMs;
      stats.errors.push(...result.errors.map((error) => `${business.id}: ${error}`));

      if (result.status === "enriched") stats.enriched += 1;
      if (result.status === "unchanged") stats.unchanged += 1;
      if (result.status === "miss") stats.missed += 1;
      if (result.status === "failed") stats.failed += 1;
      if (result.status === "skipped") stats.skipped += 1;

      await applyEnrichmentResult(business, result);
      if (result.status === "enriched" || result.status === "unchanged") {
        refreshedIds.add(business.id);
      }

      logger.info(
        {
          businessId: business.id,
          connector: connector.name,
          status: result.status,
          latencyMs: result.latencyMs,
        },
        "External enrichment processed business",
      );
    }
  }

  if (refreshedIds.size > 0) {
    await refreshBusinessResearchStates(Array.from(refreshedIds));
  }

  return Array.from(statsBySource.values());
}

export function getEnrichmentSourceDecisions() {
  return [
    {
      source: "osm_overpass",
      decision: "implement_now",
      reason: "Primary POI discovery source already integrated; keep bounded bbox imports and public-instance-safe volume.",
      documentationUrl: "https://dev.overpass-api.de/overpass-doc/en/preface/commons.html",
    },
    {
      source: "wikidata",
      decision: "implement_now",
      reason: "Structured CC0 identifiers and official URLs for cultural institutions; use exact-label/bounded queries only.",
      documentationUrl: "https://www.wikidata.org/wiki/Wikidata:Data_access",
    },
    {
      source: "overture_maps",
      decision: "document_only",
      reason: "High-value open POI dataset, but safe use requires bounded GeoParquet/DuckDB workflow and local runtime tooling.",
      documentationUrl: "https://docs.overturemaps.org/getting-data/",
    },
    {
      source: "geonames",
      decision: "document_only",
      reason: "Useful for city/admin normalization, not business enrichment; downloadable CC-BY datasets are preferable to live API calls.",
      documentationUrl: "https://download.geonames.org/export/dump/",
    },
    {
      source: "opencorporates",
      decision: "disabled_by_config",
      reason: "Requires API account/token and plan-specific limits; keep optional until account status and use case are explicit.",
      documentationUrl: "https://api.opencorporates.com/documentation/API-Reference",
    },
    {
      source: "eu_open_data",
      decision: "document_only",
      reason: "Portal is useful for dataset discovery, but each local dataset has distinct schema/license and should be a plugin.",
      documentationUrl: "https://data.europa.eu/en/which-apis-are-available-and-where-can-i-find-information-about-them",
    },
  ] as const;
}
