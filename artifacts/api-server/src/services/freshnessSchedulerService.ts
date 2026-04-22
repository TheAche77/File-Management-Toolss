import {
  businessSourcesTable,
  businessesTable,
  contactCandidatesTable,
  db,
} from "@workspace/db";
import { and, eq, inArray, isNotNull, lte, or } from "drizzle-orm";
import { enqueueResearchJobs } from "./researchJobService";

export async function scheduleDueResearchWork(limit = 50) {
  const now = new Date();

  const [businessRows, sourceRows, candidateRows, enrichmentRows] = await Promise.all([
    db
      .select({
        id: businessesTable.id,
      })
      .from(businessesTable)
      .where(
        and(
          isNotNull(businessesTable.nextResearchAt),
          lte(businessesTable.nextResearchAt, now),
        ),
      )
      .limit(limit),
    db
      .select({
        id: businessSourcesTable.id,
        businessId: businessSourcesTable.businessId,
      })
      .from(businessSourcesTable)
      .where(
        and(
          isNotNull(businessSourcesTable.nextFetchAt),
          lte(businessSourcesTable.nextFetchAt, now),
          inArray(businessSourcesTable.freshnessStatus, ["aging", "stale", "unknown"]),
        ),
      )
      .limit(limit),
    db
      .select({
        businessId: contactCandidatesTable.businessId,
      })
      .from(contactCandidatesTable)
      .where(
        and(
          isNotNull(contactCandidatesTable.nextVerificationAt),
          lte(contactCandidatesTable.nextVerificationAt, now),
          or(
            eq(contactCandidatesTable.verificationStatus, "unverified"),
            eq(contactCandidatesTable.verificationStatus, "reachable"),
          ),
        ),
      )
      .limit(limit),
    db
      .select({
        id: businessesTable.id,
      })
      .from(businessesTable)
      .where(
        and(
          isNotNull(businessesTable.website),
          or(
            eq(businessesTable.reviewReason, "missing_official_source"),
            eq(businessesTable.sourceHealth, "weak"),
          ),
        ),
      )
      .limit(limit),
  ]);

  const jobs = [
    ...businessRows.map((row) => ({
      jobType: "ranking_refresh" as const,
      businessId: row.id,
      priority: 60,
    })),
    ...sourceRows.map((row) => ({
      jobType: "source_fetch" as const,
      businessId: row.businessId,
      sourceId: row.id,
      priority: 70,
    })),
    ...Array.from(new Set(candidateRows.map((row) => row.businessId))).map((businessId) => ({
      jobType: "contact_verification" as const,
      businessId,
      priority: 65,
    })),
    ...enrichmentRows.map((row) => ({
      jobType: "official_site_enrichment" as const,
      businessId: row.id,
      priority: 75,
    })),
  ];

  const queued = await enqueueResearchJobs(jobs);
  return {
    queued: queued.length,
    dueBusinesses: businessRows.length,
    dueSources: sourceRows.length,
    dueContactVerifications: candidateRows.length,
    dueEnrichments: enrichmentRows.length,
  };
}
