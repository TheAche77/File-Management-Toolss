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

function buildSourceIdentityKey(record: {
  businessId: number;
  sourceType: string;
  sourceUrl: string;
}) {
  return `${record.businessId}::${record.sourceType}::${record.sourceUrl}`;
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
    });
  };

  pushSource("osm_record", buildOsmSourceUrl(record.business), false);
  pushSource("official_website", record.business.website, true);
  pushSource("google_maps", record.business.googleMapsUrl, false);

  return sources;
}

export async function upsertBusinessSources(records: InsertBusinessSource[]): Promise<void> {
  if (records.length === 0) return;

  const uniqueRecords = Array.from(
    new Map(records.map((record) => [buildSourceIdentityKey(record), record])).values(),
  );
  const businessIds = Array.from(new Set(uniqueRecords.map((record) => record.businessId)));

  await db.transaction(async (tx) => {
    const existingRows = businessIds.length
      ? await tx
          .select({
            id: businessSourcesTable.id,
            businessId: businessSourcesTable.businessId,
            sourceType: businessSourcesTable.sourceType,
            sourceUrl: businessSourcesTable.sourceUrl,
          })
          .from(businessSourcesTable)
          .where(inArray(businessSourcesTable.businessId, businessIds))
      : [];

    const existingByKey = new Map(
      existingRows.map((row) => [buildSourceIdentityKey(row), row]),
    );

    const inserts: InsertBusinessSource[] = [];

    for (const record of uniqueRecords) {
      const existing = existingByKey.get(buildSourceIdentityKey(record));

      if (existing) {
        await tx
          .update(businessSourcesTable)
          .set({
            sourceDomain: record.sourceDomain,
            discoveredVia: record.discoveredVia,
            fetchStatus: record.fetchStatus,
            lastFetchedAt: record.lastFetchedAt ?? new Date(),
            contentHash: record.contentHash ?? null,
            httpStatus: record.httpStatus ?? null,
            isOfficial: record.isOfficial,
            updatedAt: new Date(),
          })
          .where(eq(businessSourcesTable.id, existing.id));
      } else {
        inserts.push(record);
      }
    }

    if (inserts.length > 0) {
      await tx.insert(businessSourcesTable).values(inserts);
    }
  });

  logger.info({ count: uniqueRecords.length }, "Business sources upserted");
}

export async function getBusinessSources(businessId: number) {
  return db
    .select()
    .from(businessSourcesTable)
    .where(eq(businessSourcesTable.businessId, businessId))
    .orderBy(desc(businessSourcesTable.isOfficial), businessSourcesTable.sourceType, desc(businessSourcesTable.updatedAt));
}
