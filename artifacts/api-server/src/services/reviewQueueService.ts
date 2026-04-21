import {
  businessSourcesTable,
  businessesTable,
  db,
  type Business,
} from "@workspace/db";
import { and, eq, ilike, inArray, or, sql } from "drizzle-orm";

export type ReviewReason =
  | "missing_website"
  | "missing_phone"
  | "pending_enrichment"
  | "missing_official_source"
  | "failed_source_fetch";

export interface ReviewQueueItem {
  business: Business;
  reasons: ReviewReason[];
  priorityScore: number;
  sourceCount: number;
  officialSourceCount: number;
  failedSourceCount: number;
}

export interface ReviewQueueFilters {
  categorySlug?: string;
  city?: string;
  limit?: number;
}

function getPriorityScore(reasons: ReviewReason[], failedSourceCount: number): number {
  let score = 0;

  if (reasons.includes("missing_website")) score += 4;
  if (reasons.includes("missing_phone")) score += 3;
  if (reasons.includes("pending_enrichment")) score += 2;
  if (reasons.includes("missing_official_source")) score += 3;
  if (reasons.includes("failed_source_fetch")) score += 2 + Math.min(failedSourceCount, 3);

  return score;
}

export async function getReviewQueue(
  filters: ReviewQueueFilters = {},
): Promise<ReviewQueueItem[]> {
  const safeLimit =
    typeof filters.limit === "number" && Number.isFinite(filters.limit)
      ? filters.limit
      : 25;
  const requestedLimit = Math.max(1, Math.min(safeLimit, 100));
  const candidateLimit = Math.min(Math.max(requestedLimit * 4, 50), 250);

  const conditions = [
    or(
      eq(businessesTable.hasWebsite, false),
      eq(businessesTable.hasPhone, false),
      sql`${businessesTable.enrichmentStatus} <> 'enriched'`,
    ),
  ];

  if (filters.categorySlug) {
    conditions.push(eq(businessesTable.categorySlug, filters.categorySlug));
  }

  if (filters.city) {
    conditions.push(ilike(businessesTable.city, `%${filters.city}%`));
  }

  const candidates = await db
    .select()
    .from(businessesTable)
    .where(and(...conditions))
    .orderBy(businessesTable.updatedAt)
    .limit(candidateLimit);

  if (candidates.length === 0) {
    return [];
  }

  const businessIds = candidates.map((business) => business.id);

  const sources = await db
    .select()
    .from(businessSourcesTable)
    .where(inArray(businessSourcesTable.businessId, businessIds));

  const sourcesByBusinessId = new Map<number, typeof sources>();

  for (const source of sources) {
    const bucket = sourcesByBusinessId.get(source.businessId) ?? [];
    bucket.push(source);
    sourcesByBusinessId.set(source.businessId, bucket);
  }

  const queue = candidates
    .map((business) => {
      const businessSources = sourcesByBusinessId.get(business.id) ?? [];
      const officialSourceCount = businessSources.filter((source) => source.isOfficial).length;
      const failedSourceCount = businessSources.filter((source) => {
        if (source.fetchStatus === "failed") return true;
        if (typeof source.httpStatus === "number" && source.httpStatus >= 400) return true;
        return false;
      }).length;

      const reasons: ReviewReason[] = [];

      if (!business.hasWebsite) reasons.push("missing_website");
      if (!business.hasPhone) reasons.push("missing_phone");
      if (business.enrichmentStatus !== "enriched") reasons.push("pending_enrichment");
      if (officialSourceCount === 0) reasons.push("missing_official_source");
      if (failedSourceCount > 0) reasons.push("failed_source_fetch");

      return {
        business,
        reasons,
        priorityScore: getPriorityScore(reasons, failedSourceCount),
        sourceCount: businessSources.length,
        officialSourceCount,
        failedSourceCount,
      };
    })
    .filter((item) => item.reasons.length > 0)
    .sort((left, right) => {
      if (right.priorityScore !== left.priorityScore) {
        return right.priorityScore - left.priorityScore;
      }

      if (right.failedSourceCount !== left.failedSourceCount) {
        return right.failedSourceCount - left.failedSourceCount;
      }

      return (
        new Date(left.business.updatedAt).getTime() -
        new Date(right.business.updatedAt).getTime()
      );
    });

  return queue.slice(0, requestedLimit);
}
