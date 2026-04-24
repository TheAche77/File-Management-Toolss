import {
  businessSourcesTable,
  businessesTable,
  contactCandidatesTable,
  db,
  type Business,
} from "@workspace/db";
import { and, eq, ilike, inArray, or, sql } from "drizzle-orm";

export type ReviewReason =
  | "missing_website"
  | "missing_phone"
  | "pending_enrichment"
  | "missing_official_source"
  | "failed_source_fetch"
  | "missing_contact"
  | "low_confidence"
  | "stale_data"
  | "weak_sources"
  | "ambiguous_contact";

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
  targetMarket?: string;
  engineType?: string;
  targetCluster?: string;
  limit?: number;
}

export interface ReviewBucket {
  key:
    | "high_value_missing_contact"
    | "weak_sources"
    | "stale_high_priority"
    | "low_confidence_primary_contact"
    | "manual_review";
  label: string;
  items: ReviewQueueItem[];
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
      eq(businessesTable.reviewRequired, true),
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

  if (filters.targetMarket) {
    conditions.push(eq(businessesTable.targetMarket, filters.targetMarket));
  }
  if (filters.engineType) {
    conditions.push(eq(businessesTable.engineType, filters.engineType));
  }
  if (filters.targetCluster) {
    conditions.push(eq(businessesTable.targetCluster, filters.targetCluster));
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
  const contactCandidates = await db
    .select()
    .from(contactCandidatesTable)
    .where(inArray(contactCandidatesTable.businessId, businessIds));

  const sourcesByBusinessId = new Map<number, typeof sources>();
  const candidatesByBusinessId = new Map<number, typeof contactCandidates>();

  for (const source of sources) {
    const bucket = sourcesByBusinessId.get(source.businessId) ?? [];
    bucket.push(source);
    sourcesByBusinessId.set(source.businessId, bucket);
  }
  for (const candidate of contactCandidates) {
    const bucket = candidatesByBusinessId.get(candidate.businessId) ?? [];
    bucket.push(candidate);
    candidatesByBusinessId.set(candidate.businessId, bucket);
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
      const candidateRecords = candidatesByBusinessId.get(business.id) ?? [];
      const approvedCandidates = candidateRecords.filter((candidate) => candidate.reviewStatus === "approved");
      const reachableCandidates = candidateRecords.filter(
        (candidate) =>
          candidate.verificationStatus === "verified" ||
          candidate.verificationStatus === "reachable" ||
          candidate.isReachable,
      );

      const reasons: ReviewReason[] = [];

      if (business.reviewReason) {
        reasons.push(business.reviewReason as ReviewReason);
      }

      if (!business.hasWebsite) reasons.push("missing_website");
      if (!business.hasPhone) reasons.push("missing_phone");
      if (business.enrichmentStatus !== "enriched") reasons.push("pending_enrichment");
      if (officialSourceCount === 0) reasons.push("missing_official_source");
      if (failedSourceCount > 0) reasons.push("failed_source_fetch");
      if (!business.contactEmail && reachableCandidates.length === 0) reasons.push("missing_contact");
      if (
        (business.confidenceScore ?? 0) < 50 ||
        approvedCandidates.some((candidate) => Number(candidate.confidenceScore) < 0.5)
      ) {
        reasons.push("low_confidence");
      }
      if ((business.priorityScore ?? 0) >= 70 && business.nextResearchAt && business.nextResearchAt <= new Date()) {
        reasons.push("stale_data");
      }
      if ((business.sourceHealth ?? "weak") === "weak") reasons.push("weak_sources");
      if (approvedCandidates.length > 1) reasons.push("ambiguous_contact");

      return {
        business,
        reasons,
        priorityScore: business.priorityScore ?? getPriorityScore(reasons, failedSourceCount),
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

function getReviewBucketKey(item: ReviewQueueItem): ReviewBucket["key"] {
  if (item.reasons.includes("missing_contact")) return "high_value_missing_contact";
  if (item.reasons.includes("low_confidence") || item.reasons.includes("ambiguous_contact")) {
    return "low_confidence_primary_contact";
  }
  if (item.reasons.includes("stale_data")) return "stale_high_priority";
  if (
    item.reasons.includes("missing_official_source") ||
    item.reasons.includes("failed_source_fetch") ||
    item.reasons.includes("weak_sources")
  ) {
    return "weak_sources";
  }
  return "manual_review";
}

export async function getReviewBuckets(filters: ReviewQueueFilters = {}): Promise<ReviewBucket[]> {
  const items = await getReviewQueue({
    ...filters,
    limit: Math.max(filters.limit ?? 50, 100),
  });

  const buckets: ReviewBucket[] = [
    { key: "high_value_missing_contact", label: "High value missing contact", items: [] },
    { key: "weak_sources", label: "Weak or missing sources", items: [] },
    { key: "stale_high_priority", label: "Stale high priority", items: [] },
    { key: "low_confidence_primary_contact", label: "Low confidence contact", items: [] },
    { key: "manual_review", label: "Manual review", items: [] },
  ];

  const bucketMap = new Map(buckets.map((bucket) => [bucket.key, bucket]));
  for (const item of items) {
    bucketMap.get(getReviewBucketKey(item))?.items.push(item);
  }

  return buckets.filter((bucket) => bucket.items.length > 0);
}
