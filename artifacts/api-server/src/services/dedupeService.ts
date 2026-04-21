import { db, businessesTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import type { InsertBusiness, Business } from "@workspace/db";
import { logger } from "../lib/logger";
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
    country: incoming.country ?? existing.country ?? "Italy",
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

export async function bulkMergeBusinesses(items: InsertBusiness[]): Promise<BulkMergeStats> {
  if (items.length === 0) {
    return { inserted: 0, updated: 0, skipped: 0 };
  }

  const normalizedItems = dedupeIncomingBatch(items);
  const categorySlugs = Array.from(new Set(normalizedItems.map((item) => item.categorySlug)));
  const existingRecords = await db
    .select()
    .from(businessesTable)
    .where(inArray(businessesTable.categorySlug, categorySlugs));

  const indexes = buildIndexes(existingRecords);
  const inserts: InsertBusiness[] = [];
  const updates: Array<{ id: number; values: InsertBusiness }> = [];
  let skipped = 0;

  for (const item of normalizedItems) {
    const match = findExistingMatch(indexes, item);

    if (!match) {
      const insertValues = {
        ...item,
        lastCheckedAt: new Date(),
      };
      inserts.push(insertValues);
      continue;
    }

    const merged = mergeBusiness(match.record, item);
    if (!hasMeaningfulChanges(match.record, merged)) {
      skipped++;
      continue;
    }

    updates.push({ id: match.record.id, values: merged });
  }

  await db.transaction(async (tx) => {
    if (inserts.length > 0) {
      const inserted = await tx
        .insert(businessesTable)
        .values(inserts)
        .onConflictDoNothing()
        .returning();

      for (const record of inserted) {
        registerIndexes(indexes, record);
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
      }
    }
  });

  logger.info(
    {
      input: items.length,
      normalized: normalizedItems.length,
      inserted: inserts.length,
      updated: updates.length,
      skipped,
    },
    "Bulk merge completed",
  );

  return {
    inserted: inserts.length,
    updated: updates.length,
    skipped,
  };
}

export async function upsertBusiness(
  incoming: InsertBusiness,
): Promise<{ action: DedupeAction; id: number }> {
  const normalized = normalizeIncomingBusiness(incoming);
  const stats = await bulkMergeBusinesses([normalized]);
  const action: DedupeAction = stats.inserted > 0 ? "insert" : "update";

  const categoryRows = await db
    .select()
    .from(businessesTable)
    .where(eq(businessesTable.categorySlug, normalized.categorySlug));

  const indexes = buildIndexes(categoryRows);
  const match = findExistingMatch(indexes, normalized);

  return { action, id: match?.record.id ?? 0 };
}
