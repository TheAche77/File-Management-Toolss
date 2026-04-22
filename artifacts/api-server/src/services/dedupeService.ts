import { db, businessesTable } from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";
import type { InsertBusiness, Business } from "@workspace/db";
import { logger } from "../lib/logger";
import { inferTargetMarket } from "../lib/locationProfiles";
import {
  buildCoordNameKey,
  buildOsmKey,
  buildSlugKey,
  buildWebsiteKey,
  computeEnrichmentStatus,
  normalizeIncomingBusiness,
} from "./businessNormalization";

export type DedupeAction = "insert" | "update";

export interface BulkMergeStats {
  inserted: number;
  updated: number;
  skipped: number;
}

export interface BulkMergeRecord {
  id: number;
  action: DedupeAction | "skip";
  business: InsertBusiness;
}

export interface BulkMergeResult extends BulkMergeStats {
  records: BulkMergeRecord[];
}

interface ExistingMatch {
  record: Business;
}

function buildIndexes(records: Business[]) {
  const byOsmKey = new Map<string, ExistingMatch>();
  const byWebsiteKey = new Map<string, ExistingMatch>();
  const byCoordNameKey = new Map<string, ExistingMatch>();
  const bySlugKey = new Map<string, ExistingMatch>();

  for (const record of records) {
    const osmKey = buildOsmKey(record.categorySlug, record.osmId, record.osmType);
    if (osmKey) byOsmKey.set(osmKey, { record });

    const websiteKey = buildWebsiteKey(record.categorySlug, record.website);
    if (websiteKey) byWebsiteKey.set(websiteKey, { record });

    const coordKey = buildCoordNameKey(record.categorySlug, record.name, record.latitude, record.longitude);
    byCoordNameKey.set(coordKey, { record });

    const slugKey = buildSlugKey(record.categorySlug, record.slug);
    bySlugKey.set(slugKey, { record });
  }

  return { byOsmKey, byWebsiteKey, byCoordNameKey, bySlugKey };
}

function findExistingMatch(
  indexes: ReturnType<typeof buildIndexes>,
  incoming: InsertBusiness,
): ExistingMatch | null {
  const osmKey = buildOsmKey(incoming.categorySlug, incoming.osmId, incoming.osmType);
  if (osmKey && indexes.byOsmKey.has(osmKey)) return indexes.byOsmKey.get(osmKey)!;

  const websiteKey = buildWebsiteKey(incoming.categorySlug, incoming.website);
  if (websiteKey && indexes.byWebsiteKey.has(websiteKey)) return indexes.byWebsiteKey.get(websiteKey)!;

  const coordKey = buildCoordNameKey(incoming.categorySlug, incoming.name, incoming.latitude, incoming.longitude);
  if (indexes.byCoordNameKey.has(coordKey)) return indexes.byCoordNameKey.get(coordKey)!;

  const slugKey = buildSlugKey(incoming.categorySlug, incoming.slug);
  return indexes.bySlugKey.get(slugKey) ?? null;
}

function toComparableValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function hasMeaningfulChanges(existing: Business, merged: InsertBusiness): boolean {
  const comparableFields: Array<keyof InsertBusiness> = [
    "name",
    "slug",
    "latitude",
    "longitude",
    "addressLine",
    "city",
    "postalCode",
    "region",
    "country",
    "website",
    "phone",
    "osmId",
    "osmType",
    "googlePlaceId",
    "googleMapsUrl",
    "rating",
    "userRatingsTotal",
    "hasWebsite",
    "hasPhone",
    "targetMarket",
    "enrichmentStatus",
  ];

  return comparableFields.some((field) => toComparableValue(existing[field]) !== toComparableValue(merged[field]));
}

function mergeBusiness(existing: Business, incoming: InsertBusiness): InsertBusiness {
  const merged: InsertBusiness = {
    categorySlug: incoming.categorySlug,
    name: incoming.name,
    slug: incoming.slug,
    latitude: incoming.latitude,
    longitude: incoming.longitude,
    addressLine: incoming.addressLine ?? existing.addressLine ?? null,
    city: incoming.city ?? existing.city ?? null,
    postalCode: incoming.postalCode ?? existing.postalCode ?? null,
    region: incoming.region ?? existing.region ?? null,
    country: incoming.country ?? existing.country ?? null,
    website: incoming.website ?? existing.website ?? null,
    phone: incoming.phone ?? existing.phone ?? null,
    osmId: incoming.osmId ?? existing.osmId ?? null,
    osmType: incoming.osmType ?? existing.osmType ?? null,
    googlePlaceId: incoming.googlePlaceId ?? existing.googlePlaceId ?? null,
    googleMapsUrl: incoming.googleMapsUrl ?? existing.googleMapsUrl ?? null,
    rating: incoming.rating ?? existing.rating ?? null,
    userRatingsTotal: incoming.userRatingsTotal ?? existing.userRatingsTotal ?? null,
    hasWebsite: Boolean(incoming.website ?? existing.website),
    hasPhone: Boolean(incoming.phone ?? existing.phone),
    targetMarket:
      existing.targetMarket ??
      incoming.targetMarket ??
      inferTargetMarket(
        (incoming.city ?? existing.city ?? null) as string | null,
        (incoming.country ?? existing.country ?? null) as string | null,
      ),
    enrichmentStatus: "pending",
    lastCheckedAt: new Date(),
  };

  merged.enrichmentStatus = computeEnrichmentStatus(merged);
  return merged;
}

function registerIndexes(
  indexes: ReturnType<typeof buildIndexes>,
  record: Business,
) {
  const match: ExistingMatch = { record };

  const osmKey = buildOsmKey(record.categorySlug, record.osmId, record.osmType);
  if (osmKey) indexes.byOsmKey.set(osmKey, match);

  const websiteKey = buildWebsiteKey(record.categorySlug, record.website);
  if (websiteKey) indexes.byWebsiteKey.set(websiteKey, match);

  const coordKey = buildCoordNameKey(record.categorySlug, record.name, record.latitude, record.longitude);
  indexes.byCoordNameKey.set(coordKey, match);

  const slugKey = buildSlugKey(record.categorySlug, record.slug);
  indexes.bySlugKey.set(slugKey, match);
}

function dedupeIncomingBatch(items: InsertBusiness[]): InsertBusiness[] {
  const byIdentity = new Map<string, InsertBusiness>();

  for (const rawItem of items) {
    const item = normalizeIncomingBusiness(rawItem);
    const key =
      buildOsmKey(item.categorySlug, item.osmId, item.osmType) ??
      buildWebsiteKey(item.categorySlug, item.website) ??
      buildCoordNameKey(item.categorySlug, item.name, item.latitude, item.longitude) ??
      buildSlugKey(item.categorySlug, item.slug);

    const existing = byIdentity.get(key);
    if (!existing) {
      byIdentity.set(key, item);
      continue;
    }

    byIdentity.set(
      key,
      mergeBusiness(
        {
          id: 0,
          createdAt: new Date(0),
          updatedAt: new Date(0),
          ...existing,
        } as Business,
        item,
      ),
    );
  }

  return Array.from(byIdentity.values());
}

export async function bulkMergeBusinesses(items: InsertBusiness[]): Promise<BulkMergeResult> {
  if (items.length === 0) {
    return { inserted: 0, updated: 0, skipped: 0, records: [] };
  }

  const normalizedItems = dedupeIncomingBatch(items);
  const categorySlugs = Array.from(new Set(normalizedItems.map((item) => item.categorySlug)));
  const existingRecords = await db
    .select()
    .from(businessesTable)
    .where(inArray(businessesTable.categorySlug, categorySlugs));

  const indexes = buildIndexes(existingRecords);
  const inserts: Array<{ item: InsertBusiness; key: string }> = [];
  const updates: Array<{ id: number; values: InsertBusiness }> = [];
  const records: BulkMergeRecord[] = [];
  let skipped = 0;

  for (const item of normalizedItems) {
    const match = findExistingMatch(indexes, item);

    if (!match) {
      const insertValues: InsertBusiness = {
        ...item,
        lastCheckedAt: new Date(),
      };
      inserts.push({
        item: insertValues,
        key: buildSlugKey(item.categorySlug, item.slug),
      });
      continue;
    }

    const merged = mergeBusiness(match.record, item);
    if (!hasMeaningfulChanges(match.record, merged)) {
      skipped++;
      records.push({ id: match.record.id, action: "skip", business: merged });
      continue;
    }

    updates.push({ id: match.record.id, values: merged });
  }

  await db.transaction(async (tx) => {
    if (inserts.length > 0) {
      const inserted = await tx
        .insert(businessesTable)
        .values(inserts.map((entry) => entry.item))
        .onConflictDoNothing()
        .returning();

      const insertedByKey = new Map(
        inserted.map((record) => [buildSlugKey(record.categorySlug, record.slug), record]),
      );

      for (const record of inserted) {
        registerIndexes(indexes, record);
      }

      for (const entry of inserts) {
        const insertedRecord = insertedByKey.get(entry.key);
        if (insertedRecord) {
          records.push({ id: insertedRecord.id, action: "insert", business: entry.item });
          continue;
        }

        const existing = await tx
          .select()
          .from(businessesTable)
          .where(
            and(
              eq(businessesTable.categorySlug, entry.item.categorySlug),
              eq(businessesTable.slug, entry.item.slug),
            ),
          )
          .limit(1);

        if (existing.length > 0) {
          records.push({ id: existing[0]!.id, action: "update", business: entry.item });
        }
      }
    }

    for (const update of updates) {
      const [updatedRecord] = await tx
        .update(businessesTable)
        .set({ ...update.values, updatedAt: new Date() })
        .where(eq(businessesTable.id, update.id))
        .returning();

      if (updatedRecord) {
        registerIndexes(indexes, updatedRecord);
        records.push({ id: updatedRecord.id, action: "update", business: update.values });
      }
    }
  });

  logger.info(
    {
      input: items.length,
      normalized: normalizedItems.length,
      inserted: records.filter((record) => record.action === "insert").length,
      updated: records.filter((record) => record.action === "update").length,
      skipped,
    },
    "Bulk merge completed",
  );

  return {
    inserted: records.filter((record) => record.action === "insert").length,
    updated: records.filter((record) => record.action === "update").length,
    skipped,
    records,
  };
}

export async function upsertBusiness(
  incoming: InsertBusiness,
): Promise<{ action: DedupeAction; id: number }> {
  const normalized = normalizeIncomingBusiness(incoming);
  const result = await bulkMergeBusinesses([normalized]);
  const firstRecord = result.records[0];

  return {
    action: firstRecord?.action === "insert" ? "insert" : "update",
    id: firstRecord?.id ?? 0,
  };
}
