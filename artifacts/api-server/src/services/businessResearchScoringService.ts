import type { BusinessSource, ContactCandidate } from "@workspace/db";
import type { BusinessResearchAggregate } from "./businessResearchAggregateService";

const CORE_CATEGORY_WEIGHTS: Record<string, number> = {
  art_gallery: 35,
  urban_art_gallery: 35,
  art_museum: 30,
  cultural_institute: 30,
  design_boutique_hotel: 28,
  boutique_hotel: 26,
  bookstore: 20,
  bookshop: 20,
};

const TARGET_MARKET_WEIGHTS: Record<string, number> = {
  IT: 20,
  UK: 20,
  NL: 18,
  FR: 18,
  ES: 16,
  PT: 16,
  RO: 16,
};

const AVATAR_CATEGORY_FIT: Record<string, string[]> = {
  gallery_director: ["art_gallery", "urban_art_gallery"],
  hotel_art_curator: ["design_boutique_hotel", "boutique_hotel", "hotel"],
  festival: ["festival", "cultural_institute"],
  museum_shop: ["art_museum", "museum", "bookshop", "bookstore"],
  institution: ["cultural_institute", "institution", "art_museum"],
};

export interface BusinessResearchSnapshot {
  primarySourceId: number | null;
  primarySourceType: string | null;
  primarySourceUrl: string | null;
  primaryContactCandidateId: number | null;
  primaryContactType: string | null;
  primaryContactValue: string | null;
  primaryContactName: string | null;
  primaryContactRole: string | null;
  officialSourceCount: number;
  successfulSourceCount: number;
  failedSourceCount: number;
  sourceHealth: "good" | "mixed" | "weak";
  contactReadiness: "none" | "basic" | "usable" | "strong";
  discoveryStatus: "discovered" | "merged" | "discarded";
  qualificationStatus: "qualified" | "deprioritized" | "unqualified";
  contactabilityStatus: "unknown" | "basic" | "contactable" | "verified";
  rankingStatus: "pending" | "review" | "ready" | "scored";
  relevanceScore: number;
  contactabilityScore: number;
  confidenceScore: number;
  freshnessScore: number;
  priorityScore: number;
  researchScore: number;
  readyForOutreach: boolean;
  reviewRequired: boolean;
  reviewReason: string | null;
  topGap: string | null;
  recommendedNextStep: string;
  lastResearchAt: Date;
  nextResearchAt: Date;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function parseConfidenceScore(value: string | null | undefined) {
  const numeric = Number(value ?? 0);
  if (Number.isNaN(numeric)) return 0;
  return Math.max(0, Math.min(1, numeric));
}

function getPrimarySourceScore(source: BusinessSource) {
  let score = 0;
  if (source.sourceType === "official_website_page") score += 60;
  else if (source.sourceType === "official_website") score += 50;
  else if (source.isOfficial) score += 40;
  else if (source.sourceType === "osm_record") score += 15;

  if (source.fetchStatus === "fetched") score += 25;
  if (source.httpStatus === 200) score += 15;
  if (source.contentHash) score += 10;
  if (source.lastFetchedAt) score += 5;

  return score;
}

function selectPrimarySource(sources: BusinessSource[]) {
  if (sources.length === 0) return null;

  return [...sources].sort((left, right) => {
    const delta = getPrimarySourceScore(right) - getPrimarySourceScore(left);
    if (delta !== 0) return delta;

    const leftFetched = left.lastFetchedAt?.getTime() ?? 0;
    const rightFetched = right.lastFetchedAt?.getTime() ?? 0;
    return rightFetched - leftFetched;
  })[0]!;
}

function getContactValue(candidate: ContactCandidate) {
  return candidate.email ?? candidate.phone ?? candidate.contactUrl ?? null;
}

function getPrimaryContactScore(candidate: ContactCandidate) {
  let score = Math.round(parseConfidenceScore(candidate.confidenceScore) * 100);
  if (candidate.isPrimary) score += 35;
  if (candidate.reviewStatus === "approved") score += 25;
  if (candidate.contactType === "generic_email") score += 20;
  if (candidate.contactType === "phone_contact") score += 14;
  if (candidate.contactType === "website_contact") score += 8;
  if (candidate.email) score += 10;
  if (candidate.fullName) score += 6;
  if (candidate.role) score += 4;
  return score;
}

function selectPrimaryContact(candidates: ContactCandidate[]) {
  const eligible = candidates.filter((candidate) => candidate.reviewStatus !== "rejected");
  if (eligible.length === 0) return null;

  return [...eligible].sort((left, right) => {
    const delta = getPrimaryContactScore(right) - getPrimaryContactScore(left);
    if (delta !== 0) return delta;

    const leftVerified = left.lastVerifiedAt?.getTime() ?? 0;
    const rightVerified = right.lastVerifiedAt?.getTime() ?? 0;
    return rightVerified - leftVerified;
  })[0]!;
}

function getOfficialSourceCount(sources: BusinessSource[]) {
  return sources.filter((source) => source.isOfficial).length;
}

function getSuccessfulSourceCount(sources: BusinessSource[]) {
  return sources.filter((source) => source.fetchStatus === "fetched").length;
}

function getFailedSourceCount(sources: BusinessSource[]) {
  return sources.filter((source) => source.fetchStatus === "failed").length;
}

function computeSourceHealth(
  officialSourceCount: number,
  successfulSourceCount: number,
  failedSourceCount: number,
): "good" | "mixed" | "weak" {
  if (officialSourceCount > 0 && successfulSourceCount > 0 && failedSourceCount <= successfulSourceCount) {
    return "good";
  }
  if (successfulSourceCount > 0) {
    return "mixed";
  }
  return "weak";
}

function computeContactReadiness(
  aggregate: BusinessResearchAggregate,
  primaryContact: ContactCandidate | null,
): "none" | "basic" | "usable" | "strong" {
  if (primaryContact && (primaryContact.isPrimary || primaryContact.reviewStatus === "approved")) {
    return "strong";
  }
  if (primaryContact?.email || aggregate.business.contactEmail || aggregate.business.phone) {
    return "usable";
  }
  if (aggregate.business.website || aggregate.business.phone) {
    return "basic";
  }
  return "none";
}

function computeRelevanceScore(aggregate: BusinessResearchAggregate, officialSourceCount: number) {
  const categoryFit = CORE_CATEGORY_WEIGHTS[aggregate.business.categorySlug] ?? 12;
  const marketFit = TARGET_MARKET_WEIGHTS[aggregate.business.targetMarket ?? ""] ?? 0;

  const avatarType = aggregate.business.avatarType ?? "";
  const avatarFit = (AVATAR_CATEGORY_FIT[avatarType] ?? []).includes(aggregate.business.categorySlug)
    ? 20
    : avatarType
      ? 10
      : 0;
  const sourceFit = officialSourceCount > 0 ? 10 : aggregate.sources.some((source) => source.sourceType === "osm_record") ? 4 : 0;
  let businessSignalFit = 0;
  if (aggregate.business.website) businessSignalFit += 7;
  if (aggregate.business.phone) businessSignalFit += 4;
  if (aggregate.business.rating) businessSignalFit += 2;
  if (aggregate.business.userRatingsTotal) businessSignalFit += 2;

  return clampScore(categoryFit + marketFit + avatarFit + sourceFit + businessSignalFit);
}

function computeContactabilityScore(
  aggregate: BusinessResearchAggregate,
  primaryContact: ContactCandidate | null,
) {
  let score = 0;
  if (aggregate.business.website || aggregate.business.hasWebsite) score += 20;
  if (aggregate.business.phone || aggregate.business.hasPhone) score += 10;

  const emailCandidate = aggregate.contactCandidates.find((candidate) => candidate.email);
  if (aggregate.business.contactEmail || emailCandidate?.email) score += 25;

  if (primaryContact?.isPrimary && primaryContact.reviewStatus === "approved") score += 25;
  else if (primaryContact) score += 15;

  const contactReadiness = computeContactReadiness(aggregate, primaryContact);
  if (contactReadiness === "strong") score += 20;
  else if (contactReadiness === "usable") score += 10;
  else if (contactReadiness === "basic") score += 4;

  return clampScore(score);
}

function computeConfidenceScore(
  aggregate: BusinessResearchAggregate,
  officialSourceCount: number,
  successfulSourceCount: number,
  primaryContact: ContactCandidate | null,
) {
  let score = 0;

  if (officialSourceCount >= 2) score += 30;
  else if (officialSourceCount === 1) score += 20;
  else if (aggregate.sources.some((source) => source.sourceType === "osm_record")) score += 8;

  const sourceDomains = new Set(
    aggregate.sources
      .map((source) => source.sourceDomain?.toLowerCase())
      .filter((value): value is string => Boolean(value)),
  );
  if (sourceDomains.size <= 1 && aggregate.sources.length > 0) score += 20;
  else if (sourceDomains.size <= 2) score += 10;

  if (primaryContact) {
    if (primaryContact.reviewStatus === "approved") score += 20;
    else score += clampScore(parseConfidenceScore(primaryContact.confidenceScore) * 20);
  }

  if (successfulSourceCount >= 2) score += 15;
  else if (successfulSourceCount === 1) score += 8;

  const latestTimestamp = getMostRecentTimestamp(aggregate);
  if (latestTimestamp) {
    const ageDays = getAgeInDays(latestTimestamp);
    if (ageDays <= 7) score += 15;
    else if (ageDays <= 30) score += 8;
  }

  return clampScore(score);
}

function getMostRecentTimestamp(aggregate: BusinessResearchAggregate) {
  const timestamps = [
    aggregate.business.lastCheckedAt,
    aggregate.business.updatedAt,
    ...aggregate.sources.map((source) => source.lastFetchedAt ?? source.updatedAt),
    ...aggregate.contactCandidates.map((candidate) => candidate.lastVerifiedAt ?? candidate.updatedAt),
  ].filter((value): value is Date => Boolean(value));

  if (timestamps.length === 0) return null;

  return new Date(Math.max(...timestamps.map((value) => value.getTime())));
}

function getAgeInDays(value: Date) {
  return Math.floor((Date.now() - value.getTime()) / 86_400_000);
}

function computeFreshnessScore(aggregate: BusinessResearchAggregate) {
  let score = 0;

  const latestSourceFetch = aggregate.sources
    .map((source) => source.lastFetchedAt)
    .filter((value): value is Date => Boolean(value))
    .sort((left, right) => right.getTime() - left.getTime())[0];
  if (latestSourceFetch) {
    const ageDays = getAgeInDays(latestSourceFetch);
    if (ageDays <= 7) score += 40;
    else if (ageDays <= 30) score += 20;
  }

  const latestContactVerification = aggregate.contactCandidates
    .map((candidate) => candidate.lastVerifiedAt)
    .filter((value): value is Date => Boolean(value))
    .sort((left, right) => right.getTime() - left.getTime())[0];
  if (latestContactVerification) {
    const ageDays = getAgeInDays(latestContactVerification);
    if (ageDays <= 14) score += 30;
    else if (ageDays <= 45) score += 15;
  }

  const lastCheckedAt = aggregate.business.lastCheckedAt ?? aggregate.business.updatedAt;
  if (lastCheckedAt) {
    const ageDays = getAgeInDays(lastCheckedAt);
    if (ageDays <= 14) score += 20;
    else if (ageDays <= 45) score += 10;
  }

  if (aggregate.sources.some((source) => Boolean(source.contentHash))) {
    score += 10;
  }

  return clampScore(score);
}

function computePriorityScore(scores: {
  relevanceScore: number;
  contactabilityScore: number;
  confidenceScore: number;
  freshnessScore: number;
}) {
  return clampScore(
    scores.relevanceScore * 0.35 +
      scores.contactabilityScore * 0.3 +
      scores.confidenceScore * 0.2 +
      scores.freshnessScore * 0.15,
  );
}

function computeOpportunityGapScore(
  relevanceScore: number,
  contactabilityScore: number,
  officialSourceCount: number,
) {
  let score = 0;
  if (relevanceScore >= 70 && contactabilityScore < 60) score += 60;
  if (officialSourceCount === 0) score += 25;
  if (contactabilityScore < 40) score += 15;
  return clampScore(score);
}

function computeResearchScore(scores: {
  relevanceScore: number;
  confidenceScore: number;
  freshnessScore: number;
  opportunityGapScore: number;
}) {
  return clampScore(
    scores.relevanceScore * 0.45 +
      scores.confidenceScore * 0.2 +
      scores.freshnessScore * 0.2 +
      scores.opportunityGapScore * 0.15,
  );
}

function computeReviewState(input: {
  relevanceScore: number;
  contactabilityScore: number;
  confidenceScore: number;
  freshnessScore: number;
  officialSourceCount: number;
  primaryContact: ContactCandidate | null;
  sourceHealth: "good" | "mixed" | "weak";
}) {
  if (input.relevanceScore >= 70 && input.contactabilityScore < 60) {
    return { reviewRequired: true, reviewReason: "missing_contact", topGap: "missing_contact" };
  }
  if (input.relevanceScore >= 70 && input.confidenceScore < 50) {
    return { reviewRequired: true, reviewReason: "low_confidence", topGap: "low_confidence" };
  }
  if (!input.primaryContact && input.officialSourceCount === 0 && input.relevanceScore >= 65) {
    return {
      reviewRequired: true,
      reviewReason: "missing_official_source",
      topGap: "missing_official_source",
    };
  }
  if (input.freshnessScore < 30 && input.relevanceScore >= 70) {
    return { reviewRequired: true, reviewReason: "stale_data", topGap: "stale_data" };
  }
  if (input.sourceHealth === "weak" && input.relevanceScore >= 70) {
    return { reviewRequired: true, reviewReason: "weak_sources", topGap: "weak_sources" };
  }

  return { reviewRequired: false, reviewReason: null, topGap: null };
}

function computeRecommendedNextStep(input: {
  readyForOutreach: boolean;
  officialSourceCount: number;
  primaryContact: ContactCandidate | null;
  reviewReason: string | null;
  freshnessScore: number;
  sourceHealth: "good" | "mixed" | "weak";
}) {
  if (input.readyForOutreach) return "move_to_outreach";
  if (input.officialSourceCount === 0 || input.sourceHealth === "weak") return "fetch_official_site";
  if (!input.primaryContact) return "find_contact";
  if (input.reviewReason === "low_confidence") return "review_contact";
  if (input.freshnessScore < 30) return "refresh_sources";
  return "review_contact";
}

function getDiscoveryStatus(aggregate: BusinessResearchAggregate) {
  return aggregate.sources.length > 0 || aggregate.business.osmId ? "merged" : "discovered";
}

function getQualificationStatus(relevanceScore: number): "qualified" | "deprioritized" | "unqualified" {
  if (relevanceScore >= 60) return "qualified";
  if (relevanceScore < 40) return "deprioritized";
  return "unqualified";
}

function getContactabilityStatus(
  contactReadiness: "none" | "basic" | "usable" | "strong",
): "unknown" | "basic" | "contactable" | "verified" {
  if (contactReadiness === "strong") return "verified";
  if (contactReadiness === "usable") return "contactable";
  if (contactReadiness === "basic") return "basic";
  return "unknown";
}

function getRankingStatus(readyForOutreach: boolean, reviewRequired: boolean) {
  if (readyForOutreach) return "ready";
  if (reviewRequired) return "review";
  return "scored";
}

function getNextResearchAt(input: {
  readyForOutreach: boolean;
  reviewRequired: boolean;
  freshnessScore: number;
}) {
  const next = new Date();
  let days = 30;

  if (input.readyForOutreach) days = 7;
  else if (input.reviewRequired) days = 3;
  else if (input.freshnessScore < 30) days = 2;
  else if (input.freshnessScore < 50) days = 10;

  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function computeBusinessResearchSnapshot(
  aggregate: BusinessResearchAggregate,
): BusinessResearchSnapshot {
  const officialSourceCount = getOfficialSourceCount(aggregate.sources);
  const successfulSourceCount = getSuccessfulSourceCount(aggregate.sources);
  const failedSourceCount = getFailedSourceCount(aggregate.sources);
  const primarySource = selectPrimarySource(aggregate.sources);
  const primaryContact = selectPrimaryContact(aggregate.contactCandidates);
  const sourceHealth = computeSourceHealth(
    officialSourceCount,
    successfulSourceCount,
    failedSourceCount,
  );
  const contactReadiness = computeContactReadiness(aggregate, primaryContact);
  const relevanceScore = computeRelevanceScore(aggregate, officialSourceCount);
  const contactabilityScore = computeContactabilityScore(aggregate, primaryContact);
  const confidenceScore = computeConfidenceScore(
    aggregate,
    officialSourceCount,
    successfulSourceCount,
    primaryContact,
  );
  const freshnessScore = computeFreshnessScore(aggregate);
  const opportunityGapScore = computeOpportunityGapScore(
    relevanceScore,
    contactabilityScore,
    officialSourceCount,
  );
  const priorityScore = computePriorityScore({
    relevanceScore,
    contactabilityScore,
    confidenceScore,
    freshnessScore,
  });
  const researchScore = computeResearchScore({
    relevanceScore,
    confidenceScore,
    freshnessScore,
    opportunityGapScore,
  });
  const reviewState = computeReviewState({
    relevanceScore,
    contactabilityScore,
    confidenceScore,
    freshnessScore,
    officialSourceCount,
    primaryContact,
    sourceHealth,
  });
  const readyForOutreach =
    relevanceScore >= 70 &&
    contactabilityScore >= 60 &&
    confidenceScore >= 65 &&
    freshnessScore >= 45 &&
    !reviewState.reviewRequired;
  const recommendedNextStep = computeRecommendedNextStep({
    readyForOutreach,
    officialSourceCount,
    primaryContact,
    reviewReason: reviewState.reviewReason,
    freshnessScore,
    sourceHealth,
  });
  const now = new Date();

  return {
    primarySourceId: primarySource?.id ?? null,
    primarySourceType: primarySource?.sourceType ?? null,
    primarySourceUrl: primarySource?.sourceUrl ?? null,
    primaryContactCandidateId: primaryContact?.id ?? null,
    primaryContactType: primaryContact?.contactType ?? null,
    primaryContactValue: primaryContact ? getContactValue(primaryContact) : null,
    primaryContactName: primaryContact?.fullName ?? null,
    primaryContactRole: primaryContact?.role ?? null,
    officialSourceCount,
    successfulSourceCount,
    failedSourceCount,
    sourceHealth,
    contactReadiness,
    discoveryStatus: getDiscoveryStatus(aggregate),
    qualificationStatus: getQualificationStatus(relevanceScore),
    contactabilityStatus: getContactabilityStatus(contactReadiness),
    rankingStatus: getRankingStatus(readyForOutreach, reviewState.reviewRequired),
    relevanceScore,
    contactabilityScore,
    confidenceScore,
    freshnessScore,
    priorityScore,
    researchScore,
    readyForOutreach,
    reviewRequired: reviewState.reviewRequired,
    reviewReason: reviewState.reviewReason,
    topGap: reviewState.topGap,
    recommendedNextStep,
    lastResearchAt: now,
    nextResearchAt: getNextResearchAt({
      readyForOutreach,
      reviewRequired: reviewState.reviewRequired,
      freshnessScore,
    }),
  };
}
