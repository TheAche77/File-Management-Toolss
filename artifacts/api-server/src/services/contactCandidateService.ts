import {
  contactCandidatesTable,
  db,
  type InsertBusiness,
  type InsertContactCandidate,
} from "@workspace/db";
import { desc, eq, inArray } from "drizzle-orm";
import type { MergedBusinessRecord } from "./businessSourceService";
import { logger } from "../lib/logger";

function buildOsmSourceUrl(business: InsertBusiness): string | null {
  if (!business.osmType || !business.osmId) return null;
  return `https://www.openstreetmap.org/${business.osmType}/${business.osmId}`;
}

function getBestSourceUrl(record: MergedBusinessRecord): { sourceUrl: string; sourceType: string } | null {
  if (record.business.website) {
    return {
      sourceUrl: record.business.website,
      sourceType: "official_website",
    };
  }

  const osmSourceUrl = buildOsmSourceUrl(record.business);
  if (osmSourceUrl) {
    return {
      sourceUrl: osmSourceUrl,
      sourceType: "osm_record",
    };
  }

  if (record.business.googleMapsUrl) {
    return {
      sourceUrl: record.business.googleMapsUrl,
      sourceType: "google_maps",
    };
  }

  return null;
}

function buildCandidateIdentityKey(record: {
  businessId: number;
  contactType: string;
  sourceType: string;
  sourceUrl: string;
}) {
  return `${record.businessId}::${record.contactType}::${record.sourceType}::${record.sourceUrl}`;
}

export function buildContactCandidatesForRecord(record: MergedBusinessRecord): InsertContactCandidate[] {
  const source = getBestSourceUrl(record);
  if (!source) return [];

  const candidates: InsertContactCandidate[] = [];

  if (record.business.website) {
    candidates.push({
      businessId: record.id,
      fullName: null,
      role: "general contact",
      contactType: "website_contact",
      email: null,
      phone: null,
      contactUrl: record.business.website,
      sourceUrl: record.business.website,
      sourceType: "official_website",
      confidenceScore: "0.70",
      isPrimary: !record.business.phone,
      isPersonalData: false,
      lastVerifiedAt: new Date(),
      reviewStatus: "suggested",
      notes: "Derived from the official website already stored on the business record.",
    });
  }

  if (record.business.phone) {
    candidates.push({
      businessId: record.id,
      fullName: null,
      role: "general contact",
      contactType: "phone_contact",
      email: null,
      phone: record.business.phone,
      contactUrl: null,
      sourceUrl: source.sourceUrl,
      sourceType: source.sourceType,
      confidenceScore: source.sourceType === "official_website" ? "0.78" : "0.60",
      isPrimary: !record.business.website,
      isPersonalData: false,
      lastVerifiedAt: new Date(),
      reviewStatus: "suggested",
      notes: "Derived from an imported public business phone number.",
    });
  }

  return candidates;
}

export async function upsertContactCandidates(records: InsertContactCandidate[]): Promise<void> {
  if (records.length === 0) return;

  const uniqueRecords = Array.from(
    new Map(records.map((record) => [buildCandidateIdentityKey(record), record])).values(),
  );
  const businessIds = Array.from(new Set(uniqueRecords.map((record) => record.businessId)));

  await db.transaction(async (tx) => {
    const existingRows = businessIds.length
      ? await tx
          .select({
            id: contactCandidatesTable.id,
            businessId: contactCandidatesTable.businessId,
            contactType: contactCandidatesTable.contactType,
            sourceType: contactCandidatesTable.sourceType,
            sourceUrl: contactCandidatesTable.sourceUrl,
          })
          .from(contactCandidatesTable)
          .where(inArray(contactCandidatesTable.businessId, businessIds))
      : [];

    const existingByKey = new Map(
      existingRows.map((row) => [buildCandidateIdentityKey(row), row]),
    );

    const inserts: InsertContactCandidate[] = [];

    for (const record of uniqueRecords) {
      const existing = existingByKey.get(buildCandidateIdentityKey(record));

      if (existing) {
        await tx
          .update(contactCandidatesTable)
          .set({
            fullName: record.fullName ?? null,
            role: record.role ?? null,
            email: record.email ?? null,
            phone: record.phone ?? null,
            contactUrl: record.contactUrl ?? null,
            confidenceScore: record.confidenceScore,
            isPrimary: record.isPrimary,
            isPersonalData: record.isPersonalData,
            lastVerifiedAt: record.lastVerifiedAt ?? new Date(),
            reviewStatus: record.reviewStatus,
            notes: record.notes ?? null,
            updatedAt: new Date(),
          })
          .where(eq(contactCandidatesTable.id, existing.id));
      } else {
        inserts.push(record);
      }
    }

    if (inserts.length > 0) {
      await tx.insert(contactCandidatesTable).values(inserts);
    }
  });

  logger.info({ count: uniqueRecords.length }, "Contact candidates upserted");
}

export async function getContactCandidates(businessId: number) {
  return db
    .select()
    .from(contactCandidatesTable)
    .where(eq(contactCandidatesTable.businessId, businessId))
    .orderBy(desc(contactCandidatesTable.isPrimary), desc(contactCandidatesTable.confidenceScore), contactCandidatesTable.contactType);
}
