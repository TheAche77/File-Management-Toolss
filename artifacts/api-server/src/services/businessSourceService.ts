import { desc, eq, inArray } from "drizzle-orm";
import {
  businessSourcesTable,
  db,
  type InsertBusiness,
  type InsertBusinessSource,
} from "@workspace/db";
import { logger } from "../lib/logger";

export interface MergedBusinessRecord {
  id: number;
  action: "insert" | "update" | "skip";
  business: InsertBusiness;
}

function getSourcePriority(sourceType: string, isOfficial: boolean) {
  if (sourceType === "official_website_page") return 95;
  if (sourceType === "official_website") return 90;
  if (sourceType === "wikidata_entity") return 70;
  if (sourceType === "overture_place") return 60;
  if (sourceType === "geonames_record") return 55;
  if (sourceType === "opencorporates_company") return 55;
  if (isOfficial) return 80;
  if (sourceType === "google_maps") return 45;
  if (sourceType === "osm_record") return 35;
  return 50;
}

function getUsefulnessScore(record: InsertBusinessSource) {
  let score = 0;
  if (record.fetchStatus === "fetched") score += 60;
  if (record.httpStatus === 200) score += 20;
  if (record.contentHash) score += 10;
  if (record.isOfficial) score += 10;
  return Math.min(score, 100);
}

function getFreshnessStatus(lastFetchedAt: Date | null | undefined) {
  if (!lastFetchedAt) return "unknown";
  const ageMs = Date.now() - lastFetchedAt.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  if (ageDays <= 7) return "fresh";
  if (ageDays <= 30) return "aging";
  return "stale";
}

function getNextFetchAt(lastFetchedAt: Date | null | undefined, isOfficial: boolean) {
  const base = lastFetchedAt ?? new Date();
  const next = new Date(base);
  next.setDate(next.getDate() + (isOfficial ? 14 : 30));
  return next;
}

function getSourceDomain(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

function buildOsmSourceUrl(business: InsertBusiness): string | null {
  if (!business.osmType || !business.osmId) return null;
  return `https://www.openstreetmap.org/${business.osmType}/${business.osmId}`;
}

export function buildBusinessSourcesForRecord(
  record: MergedBusinessRecord,
  discoveredVia: string,
): InsertBusinessSource[] {
  const sources: InsertBusinessSource[] = [];
  const seen = new Set<string>();

  const pushSource = (
    sourceType: string,
    sourceUrl: string | null | undefined,
    isOfficial: boolean,
  ) => {
    if (!sourceUrl) return;
    const key = `${sourceType}::${sourceUrl}`;
    if (seen.has(key)) return;
    seen.add(key);

    sources.push({
      businessId: record.id,
      sourceType,
      sourceUrl,
      sourceDomain: getSourceDomain(sourceUrl),
      discoveredVia,
      fetchStatus: "discovered",
      lastFetchedAt: new Date(),
      contentHash: null,
      httpStatus: null,
      isOfficial,
      sourcePriority: getSourcePriority(sourceType, isOfficial),
      usefulnessScore: 0,
      nextFetchAt: getNextFetchAt(new Date(), isOfficial),
      freshnessStatus: "fresh",
    });
  };

  pushSource("osm_record", buildOsmSourceUrl(record.business), false);
  pushSource("official_website", record.business.website, true);
  pushSource("google_maps", record.business.googleMapsUrl, false);

  return sources;
}

export async function upsertBusinessSources(records: InsertBusinessSource[]): Promise<void> {
  if (records.length === 0) return;

  const dedupedRecords = Array.from(
    new Map(
      records.map((record) => [
        `${record.businessId}::${record.sourceType}::${record.sourceUrl}`,
        record,
      ]),
    ).values(),
  );
  const businessIds = Array.from(new Set(dedupedRecords.map((record) => record.businessId)));
  const existing = await db
    .select()
    .from(businessSourcesTable)
    .where(inArray(businessSourcesTable.businessId, businessIds));
  const existingByKey = new Map(
    existing.map((record) => [
      `${record.businessId}::${record.sourceType}::${record.sourceUrl}`,
      record,
    ]),
  );

  await db.transaction(async (tx) => {
    for (const record of dedupedRecords) {
      const existingRecord = existingByKey.get(
        `${record.businessId}::${record.sourceType}::${record.sourceUrl}`,
      );

      if (existingRecord) {
        await tx
          .update(businessSourcesTable)
          .set({
            sourceDomain: record.sourceDomain,
            discoveredVia: record.discoveredVia,
            fetchStatus: record.fetchStatus,
            lastFetchedAt: record.lastFetchedAt ?? existingRecord.lastFetchedAt ?? new Date(),
            contentHash: record.contentHash ?? existingRecord.contentHash ?? null,
            sourcePayloadSummary:
              record.sourcePayloadSummary ?? existingRecord.sourcePayloadSummary ?? null,
            sourceLicense: record.sourceLicense ?? existingRecord.sourceLicense ?? null,
            sourceAttribution: record.sourceAttribution ?? existingRecord.sourceAttribution ?? null,
            sourceRateLimitBucket:
              record.sourceRateLimitBucket ?? existingRecord.sourceRateLimitBucket ?? null,
            httpStatus: record.httpStatus ?? existingRecord.httpStatus ?? null,
            isOfficial: record.isOfficial,
            sourcePriority: record.sourcePriority ?? existingRecord.sourcePriority,
            usefulnessScore: getUsefulnessScore(record),
            nextFetchAt:
              record.nextFetchAt ??
              existingRecord.nextFetchAt ??
              getNextFetchAt(
                record.lastFetchedAt ?? existingRecord.lastFetchedAt,
                Boolean(record.isOfficial),
              ),
            freshnessStatus: getFreshnessStatus(
              record.lastFetchedAt ?? existingRecord.lastFetchedAt,
            ),
            updatedAt: new Date(),
          })
          .where(eq(businessSourcesTable.id, existingRecord.id));
        continue;
      }

      await tx.insert(businessSourcesTable).values({
        ...record,
        sourcePriority:
          record.sourcePriority ??
          getSourcePriority(record.sourceType, Boolean(record.isOfficial)),
        usefulnessScore: record.usefulnessScore ?? getUsefulnessScore(record),
        nextFetchAt:
          record.nextFetchAt ??
          getNextFetchAt(record.lastFetchedAt, Boolean(record.isOfficial)),
        freshnessStatus: record.freshnessStatus ?? getFreshnessStatus(record.lastFetchedAt),
      });
    }
  });

  logger.info({ count: dedupedRecords.length }, "Business sources upserted");
}

export async function getBusinessSources(businessId: number) {
  return db
    .select()
    .from(businessSourcesTable)
    .where(eq(businessSourcesTable.businessId, businessId))
    .orderBy(desc(businessSourcesTable.isOfficial), businessSourcesTable.sourceType, desc(businessSourcesTable.updatedAt));
}
