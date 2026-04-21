import {
  contactCandidatesTable,
  db,
  type InsertBusiness,
  type InsertContactCandidate,
} from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
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

  await db.transaction(async (tx) => {
    for (const record of records) {
      const existing = await tx
        .select({ id: contactCandidatesTable.id })
        .from(contactCandidatesTable)
        .where(
          and(
            eq(contactCandidatesTable.businessId, record.businessId),
            eq(contactCandidatesTable.contactType, record.contactType),
            eq(contactCandidatesTable.sourceType, record.sourceType),
            eq(contactCandidatesTable.sourceUrl, record.sourceUrl),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
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
          .where(eq(contactCandidatesTable.id, existing[0]!.id));
      } else {
        await tx.insert(contactCandidatesTable).values(record);
      }
    }
  });

  logger.info({ count: records.length }, "Contact candidates upserted");
}

export async function getContactCandidates(businessId: number) {
  return db
    .select()
    .from(contactCandidatesTable)
    .where(eq(contactCandidatesTable.businessId, businessId))
    .orderBy(desc(contactCandidatesTable.isPrimary), desc(contactCandidatesTable.confidenceScore), contactCandidatesTable.contactType);
}
