import { businessesTable, db } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  loadBusinessResearchAggregateById,
  loadBusinessResearchAggregatesByIds,
  type BusinessResearchAggregate,
} from "./businessResearchAggregateService";
import {
  computeBusinessResearchSnapshot,
  type BusinessResearchSnapshot,
} from "./businessResearchScoringService";

function buildBusinessResearchUpdate(
  aggregate: BusinessResearchAggregate,
  snapshot: BusinessResearchSnapshot,
) {
  const derivedEmail =
    aggregate.business.contactEmail ??
    aggregate.contactCandidates.find((candidate) => candidate.reviewStatus !== "rejected" && candidate.email)?.email ??
    null;

  const derivedPhone =
    aggregate.contactCandidates.find((candidate) => candidate.reviewStatus !== "rejected" && candidate.phone)?.phone ??
    aggregate.business.phone ??
    null;

  return {
    discoveryStatus: snapshot.discoveryStatus,
    qualificationStatus: snapshot.qualificationStatus,
    contactabilityStatus: snapshot.contactabilityStatus,
    rankingStatus: snapshot.rankingStatus,
    sourceHealth: snapshot.sourceHealth,
    contactReadiness: snapshot.contactReadiness,
    relevanceScore: snapshot.relevanceScore,
    contactabilityScore: snapshot.contactabilityScore,
    confidenceScore: snapshot.confidenceScore,
    freshnessScore: snapshot.freshnessScore,
    priorityScore: snapshot.priorityScore,
    researchScore: snapshot.researchScore,
    officialSourceCount: snapshot.officialSourceCount,
    successfulSourceCount: snapshot.successfulSourceCount,
    failedSourceCount: snapshot.failedSourceCount,
    primarySourceId: snapshot.primarySourceId,
    primaryContactCandidateId: snapshot.primaryContactCandidateId,
    readyForOutreach: snapshot.readyForOutreach,
    reviewRequired: snapshot.reviewRequired,
    reviewReason: snapshot.reviewReason,
    topGap: snapshot.topGap,
    recommendedNextStep: snapshot.recommendedNextStep,
    lastQualifiedAt:
      snapshot.qualificationStatus === "qualified" ? new Date() : aggregate.business.lastQualifiedAt ?? null,
    lastContactabilityCheckAt: new Date(),
    lastResearchAt: snapshot.lastResearchAt,
    nextResearchAt: snapshot.nextResearchAt,
    hasWebsite: Boolean(aggregate.business.website),
    hasPhone: Boolean(derivedPhone),
    contactEmail: derivedEmail,
    contactName: aggregate.business.contactName ?? snapshot.primaryContactName,
    contactRole: aggregate.business.contactRole ?? snapshot.primaryContactRole,
    updatedAt: new Date(),
  };
}

export async function refreshBusinessResearchState(
  businessId: number,
) {
  const aggregate = await loadBusinessResearchAggregateById(businessId);
  if (!aggregate) return null;

  const snapshot = computeBusinessResearchSnapshot(aggregate);
  const [updated] = await db
    .update(businessesTable)
    .set(buildBusinessResearchUpdate(aggregate, snapshot))
    .where(eq(businessesTable.id, businessId))
    .returning();

  return {
    business: updated ?? null,
    snapshot,
  };
}

export async function refreshBusinessResearchStates(
  businessIds: number[],
) {
  const aggregates = await loadBusinessResearchAggregatesByIds(businessIds);
  if (aggregates.length === 0) return [];

  const results = [];
  for (const aggregate of aggregates) {
    const snapshot = computeBusinessResearchSnapshot(aggregate);
    const [updated] = await db
      .update(businessesTable)
      .set(buildBusinessResearchUpdate(aggregate, snapshot))
      .where(eq(businessesTable.id, aggregate.business.id))
      .returning();

    results.push({
      business: updated ?? null,
      snapshot,
    });
  }

  return results;
}

export async function previewBusinessResearchSnapshots(businessIds: number[]) {
  const aggregates = await loadBusinessResearchAggregatesByIds(businessIds);
  return aggregates.map((aggregate) => ({
    aggregate,
    snapshot: computeBusinessResearchSnapshot(aggregate),
  }));
}
