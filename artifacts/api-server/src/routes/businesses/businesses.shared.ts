import { db, businessesTable } from "@workspace/db";
import type { ImportRun as DbImportRun } from "@workspace/db";
import { and, eq, gte, ilike, or } from "drizzle-orm";
import { RESEARCH_JOB_TYPES } from "../../services/researchJobService";
export const CONTACT_CANDIDATE_STATUSES = new Set(["suggested", "approved", "rejected"]);
export const OUTREACH_STATUSES = new Set([
  "not_contacted",
  "emailed",
  "follow_up_1",
  "follow_up_2",
  "interested",
  "closed_won",
  "closed_lost",
]);
export const ASSIGNED_ARTISTS = new Set(["Ache77", "Exit Enter", "Nian", "Kraita317"]);
export const ASSIGNED_ARTIST_SOURCES = new Set(["auto", "manual"]);
export const AVATAR_TYPES = new Set([
  "gallery_director",
  "hotel_art_curator",
  "festival",
  "museum_shop",
  "institution",
]);
export const TARGET_MARKETS = new Set(["IT", "UK", "NL", "FR", "ES", "PT", "RO"]);
export const RESEARCH_JOB_TYPES_SET = new Set(RESEARCH_JOB_TYPES);

export function normalizeNullableString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export function normalizeNullableDateString(value: unknown): string | null | undefined {
  const normalized = normalizeNullableString(value);
  if (normalized === undefined || normalized === null) return normalized;

  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : undefined;
}

export function parseOptionalBoolean(value: string | undefined) {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

export function parseOptionalNumber(value: string | undefined) {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function buildBusinessFilters(query: Record<string, string | undefined>) {
  const conditions = [];

  if (query["search"]) {
    conditions.push(
      or(
        ilike(businessesTable.name, `%${query["search"]}%`),
        ilike(businessesTable.addressLine, `%${query["search"]}%`),
        ilike(businessesTable.city, `%${query["search"]}%`),
      ),
    );
  }
  if (query["categorySlug"]) conditions.push(eq(businessesTable.categorySlug, query["categorySlug"]));
  if (query["city"]) conditions.push(ilike(businessesTable.city, `%${query["city"]}%`));
  if (query["targetMarket"]) conditions.push(eq(businessesTable.targetMarket, query["targetMarket"]));

  const hasWebsite = parseOptionalBoolean(query["hasWebsite"]);
  const hasPhone = parseOptionalBoolean(query["hasPhone"]);
  const readyForOutreach = parseOptionalBoolean(query["readyForOutreach"]);
  const reviewRequired = parseOptionalBoolean(query["reviewRequired"]);
  const warmPathExists = parseOptionalBoolean(query["warmPathExists"]);
  const readyForRelationship = parseOptionalBoolean(query["readyForRelationship"]);
  const readyForInstitutionalPitch = parseOptionalBoolean(query["readyForInstitutionalPitch"]);
  const prestigeWatchlist = parseOptionalBoolean(query["prestigeWatchlist"]);
  const cultivationRequired = parseOptionalBoolean(query["cultivationRequired"]);
  const minPriorityScore = parseOptionalNumber(query["minPriorityScore"]);
  const minResearchScore = parseOptionalNumber(query["minResearchScore"]);
  const bestOfferId = parseOptionalNumber(query["bestOfferId"]);

  if (hasWebsite !== undefined) conditions.push(eq(businessesTable.hasWebsite, hasWebsite));
  if (hasPhone !== undefined) conditions.push(eq(businessesTable.hasPhone, hasPhone));
  if (readyForOutreach !== undefined) {
    conditions.push(eq(businessesTable.readyForOutreach, readyForOutreach));
  }
  if (reviewRequired !== undefined) {
    conditions.push(eq(businessesTable.reviewRequired, reviewRequired));
  }
  if (warmPathExists !== undefined) {
    conditions.push(eq(businessesTable.warmPathExists, warmPathExists));
  }
  if (readyForRelationship !== undefined) {
    conditions.push(eq(businessesTable.readyForRelationship, readyForRelationship));
  }
  if (readyForInstitutionalPitch !== undefined) {
    conditions.push(eq(businessesTable.readyForInstitutionalPitch, readyForInstitutionalPitch));
  }
  if (prestigeWatchlist !== undefined) {
    conditions.push(eq(businessesTable.prestigeWatchlist, prestigeWatchlist));
  }
  if (cultivationRequired !== undefined) {
    conditions.push(eq(businessesTable.cultivationRequired, cultivationRequired));
  }
  if (query["engineType"]) conditions.push(eq(businessesTable.engineType, query["engineType"]));
  if (query["targetType"]) conditions.push(eq(businessesTable.targetType, query["targetType"]));
  if (query["targetCluster"]) conditions.push(eq(businessesTable.targetCluster, query["targetCluster"]));
  if (query["accountTier"]) conditions.push(eq(businessesTable.accountTier, query["accountTier"]));
  if (bestOfferId !== undefined) conditions.push(eq(businessesTable.bestOfferId, bestOfferId));
  if (minPriorityScore !== undefined) {
    conditions.push(gte(businessesTable.priorityScore, minPriorityScore));
  }
  if (minResearchScore !== undefined) {
    conditions.push(gte(businessesTable.researchScore, minResearchScore));
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
}

export function serializeBusiness(r: Record<string, unknown>) {
  return {
    id: r["id"],
    categorySlug: r["categorySlug"],
    name: r["name"],
    slug: r["slug"],
    latitude: r["latitude"],
    longitude: r["longitude"],
    addressLine: r["addressLine"] ?? null,
    city: r["city"] ?? null,
    postalCode: r["postalCode"] ?? null,
    region: r["region"] ?? null,
    country: r["country"] ?? null,
    targetMarket: r["targetMarket"] ?? null,
    avatarType: r["avatarType"] ?? null,
    website: r["website"] ?? null,
    phone: r["phone"] ?? null,
    osmId: r["osmId"] ?? null,
    osmType: r["osmType"] ?? null,
    googlePlaceId: r["googlePlaceId"] ?? null,
    googleMapsUrl: r["googleMapsUrl"] ?? null,
    rating: r["rating"] ?? null,
    userRatingsTotal: r["userRatingsTotal"] ?? null,
    hasWebsite: r["hasWebsite"],
    hasPhone: r["hasPhone"],
    enrichmentStatus: r["enrichmentStatus"],
    discoveryStatus: r["discoveryStatus"] ?? null,
    qualificationStatus: r["qualificationStatus"] ?? null,
    contactabilityStatus: r["contactabilityStatus"] ?? null,
    rankingStatus: r["rankingStatus"] ?? null,
    sourceHealth: r["sourceHealth"] ?? null,
    contactReadiness: r["contactReadiness"] ?? null,
    relevanceScore: r["relevanceScore"] ?? null,
    contactabilityScore: r["contactabilityScore"] ?? null,
    confidenceScore: r["confidenceScore"] ?? null,
    freshnessScore: r["freshnessScore"] ?? null,
    priorityScore: r["priorityScore"] ?? null,
    researchScore: r["researchScore"] ?? null,
    engineType: r["engineType"] ?? null,
    targetType: r["targetType"] ?? null,
    targetCluster: r["targetCluster"] ?? null,
    economicValueScore: r["economicValueScore"] ?? null,
    strategicValueScore: r["strategicValueScore"] ?? null,
    referralValueScore: r["referralValueScore"] ?? null,
    prestigeValueScore: r["prestigeValueScore"] ?? null,
    continuityRevenuePotential: r["continuityRevenuePotential"] ?? null,
    offerFitScore: r["offerFitScore"] ?? null,
    relationshipPathScore: r["relationshipPathScore"] ?? null,
    actionabilityScore: r["actionabilityScore"] ?? null,
    officialSourceCount: r["officialSourceCount"] ?? null,
    successfulSourceCount: r["successfulSourceCount"] ?? null,
    failedSourceCount: r["failedSourceCount"] ?? null,
    primarySourceId: r["primarySourceId"] ?? null,
    primaryContactCandidateId: r["primaryContactCandidateId"] ?? null,
    bestOfferId: r["bestOfferId"] ?? null,
    bestNarrativeId: r["bestNarrativeId"] ?? null,
    secondaryNarrativeId: r["secondaryNarrativeId"] ?? null,
    bestCredibilityAssetId: r["bestCredibilityAssetId"] ?? null,
    bestCaseStudyId: r["bestCaseStudyId"] ?? null,
    proofAngle: r["proofAngle"] ?? null,
    riskReductionReason: r["riskReductionReason"] ?? null,
    toneOfApproach: r["toneOfApproach"] ?? null,
    recommendedPitchAngle: r["recommendedPitchAngle"] ?? null,
    nextBestContactWindow: r["nextBestContactWindow"] ?? null,
    accountTier: r["accountTier"] ?? null,
    seasonalityFit: r["seasonalityFit"] ?? null,
    warmPathExists: r["warmPathExists"] ?? false,
    readyForRelationship: r["readyForRelationship"] ?? false,
    readyForInstitutionalPitch: r["readyForInstitutionalPitch"] ?? false,
    prestigeWatchlist: r["prestigeWatchlist"] ?? false,
    cultivationRequired: r["cultivationRequired"] ?? false,
    readyForOutreach: r["readyForOutreach"] ?? false,
    reviewRequired: r["reviewRequired"] ?? false,
    reviewReason: r["reviewReason"] ?? null,
    topGap: r["topGap"] ?? null,
    recommendedNextStep: r["recommendedNextStep"] ?? null,
    lastResearchAt: (r["lastResearchAt"] as Date | null | undefined)?.toISOString() ?? null,
    nextResearchAt: (r["nextResearchAt"] as Date | null | undefined)?.toISOString() ?? null,
    createdAt: (r["createdAt"] as Date).toISOString(),
    updatedAt: (r["updatedAt"] as Date).toISOString(),
  };
}

export function serializeBusinessOutreach(r: Record<string, unknown>) {
  return {
    businessId: r["id"],
    outreachStatus: r["outreachStatus"],
    contactName: r["contactName"] ?? null,
    contactRole: r["contactRole"] ?? null,
    contactEmail: r["contactEmail"] ?? null,
    lastContactDate: r["lastContactDate"] ?? null,
    nextActionDate: r["nextActionDate"] ?? null,
    assignedArtist: r["assignedArtist"] ?? null,
    assignedArtistSource: r["assignedArtistSource"] ?? null,
    avatarType: r["avatarType"] ?? null,
    targetMarket: r["targetMarket"] ?? null,
    notes: r["notes"] ?? null,
    warmConnection: r["warmConnection"] ?? null,
    readyForOutreach: r["readyForOutreach"] ?? false,
    reviewRequired: r["reviewRequired"] ?? false,
    reviewReason: r["reviewReason"] ?? null,
    priorityScore: r["priorityScore"] ?? null,
    updatedAt: (r["updatedAt"] as Date).toISOString(),
  };
}

export function escapeCsvValue(value: unknown): string {
  if (value == null) return "";
  const stringValue = String(value);
  return stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")
    ? `"${stringValue.replace(/"/g, '""')}"`
    : stringValue;
}

export function buildCsv(headers: string[], rows: unknown[][]) {
  const BOM = "\uFEFF";
  return (
    BOM +
    [
      headers.join(","),
      ...rows.map((row) => row.map((value) => escapeCsvValue(value)).join(",")),
    ].join("\n")
  );
}

export function getTodayDateString() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

export function compareDateStrings(left: string, right: string) {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

export function diffDateStringsInDays(left: string, right: string) {
  const leftDate = new Date(`${left}T00:00:00Z`);
  const rightDate = new Date(`${right}T00:00:00Z`);
  return Math.round((leftDate.getTime() - rightDate.getTime()) / 86_400_000);
}

export function isClosedOutreachStatus(status: string) {
  return status === "closed_won" || status === "closed_lost";
}

export async function getOutreachRows() {
  return db
    .select({
      id: businessesTable.id,
      name: businessesTable.name,
      city: businessesTable.city,
      categorySlug: businessesTable.categorySlug,
      website: businessesTable.website,
      outreachStatus: businessesTable.outreachStatus,
      nextActionDate: businessesTable.nextActionDate,
      lastContactDate: businessesTable.lastContactDate,
      assignedArtist: businessesTable.assignedArtist,
      assignedArtistSource: businessesTable.assignedArtistSource,
      avatarType: businessesTable.avatarType,
      targetMarket: businessesTable.targetMarket,
      contactName: businessesTable.contactName,
      contactRole: businessesTable.contactRole,
      contactEmail: businessesTable.contactEmail,
      warmConnection: businessesTable.warmConnection,
      notes: businessesTable.notes,
      readyForOutreach: businessesTable.readyForOutreach,
      reviewRequired: businessesTable.reviewRequired,
      priorityScore: businessesTable.priorityScore,
      reviewReason: businessesTable.reviewReason,
      updatedAt: businessesTable.updatedAt,
    })
    .from(businessesTable);
}

export function getRecommendedAction(status: string) {
  switch (status) {
    case "emailed":
      return "Follow-up #1";
    case "follow_up_1":
      return "Follow-up #2";
    case "follow_up_2":
      return "Follow-up #3";
    case "interested":
      return "Proposta dettagliata";
    case "closed_won":
      return "Relationship handoff";
    case "closed_lost":
      return "Archive";
    case "not_contacted":
    default:
      return "Primo contatto";
  }
}

export function getUrgencyBucket(status: string, nextActionDate: string | null | undefined, today: string) {
  if (isClosedOutreachStatus(status)) return null;
  if (!nextActionDate) {
    return status === "not_contacted" ? "urgent" : null;
  }

  const delta = diffDateStringsInDays(nextActionDate, today);
  if (delta <= 0) return "urgent";
  if (delta <= 3) return "this_week";
  if (delta <= 7) return "next";
  return null;
}

export function getUrgencySortValue(bucket: string) {
  switch (bucket) {
    case "urgent":
      return 0;
    case "this_week":
      return 1;
    case "next":
      return 2;
    default:
      return 3;
  }
}

export function filterOutreachRows(
  rows: Awaited<ReturnType<typeof getOutreachRows>>,
  filters: {
    categorySlug?: string;
    city?: string;
    targetMarket?: string;
  },
) {
  return rows.filter((row) => {
    if (filters.categorySlug && row.categorySlug !== filters.categorySlug) {
      return false;
    }
    if (
      filters.city &&
      !(row.city ?? "").toLowerCase().includes(filters.city.toLowerCase())
    ) {
      return false;
    }
    if (filters.targetMarket && row.targetMarket !== filters.targetMarket) {
      return false;
    }

    return true;
  });
}

export function buildOutreachPipelineItems(
  rows: Awaited<ReturnType<typeof getOutreachRows>>,
  options: { today: string; horizonDays: number; limit: number },
) {
  const { today, horizonDays, limit } = options;

  return rows
    .map((row) => {
      const status = row.outreachStatus as string;
      const nextActionDate = row.nextActionDate as string | null | undefined;
      const urgencyBucket = getUrgencyBucket(status, nextActionDate, today);
      if (!urgencyBucket) return null;

      const daysUntilAction = nextActionDate ? diffDateStringsInDays(nextActionDate, today) : null;
      if (daysUntilAction !== null && daysUntilAction > horizonDays) {
        return null;
      }

      return {
        businessId: row.id,
        businessName: row.name,
        city: row.city ?? null,
        categorySlug: row.categorySlug,
        website: row.website ?? null,
        outreachStatus: status,
        nextActionDate: nextActionDate ?? null,
        lastContactDate: row.lastContactDate ?? null,
        assignedArtist: row.assignedArtist ?? null,
        assignedArtistSource: row.assignedArtistSource ?? null,
        avatarType: row.avatarType ?? null,
        targetMarket: row.targetMarket ?? null,
        contactName: row.contactName ?? null,
        contactRole: row.contactRole ?? null,
        contactEmail: row.contactEmail ?? null,
        warmConnection: row.warmConnection ?? null,
        notes: row.notes ?? null,
        readyForOutreach: row.readyForOutreach ?? false,
        reviewRequired: row.reviewRequired ?? false,
        priorityScore: row.priorityScore ?? null,
        reviewReason: row.reviewReason ?? null,
        urgencyBucket,
        daysUntilAction,
        recommendedAction: getRecommendedAction(status),
        updatedAt: row.updatedAt.toISOString(),
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((left, right) => {
      const bucketDelta =
        getUrgencySortValue(left.urgencyBucket) - getUrgencySortValue(right.urgencyBucket);
      if (bucketDelta !== 0) return bucketDelta;

      const leftDays = left.daysUntilAction ?? -1;
      const rightDays = right.daysUntilAction ?? -1;
      if (leftDays !== rightDays) return leftDays - rightDays;

      return left.businessName.localeCompare(right.businessName);
    })
    .slice(0, limit);
}

export function serializeImportRun(r: DbImportRun) {
  return {
    id: r.id,
    source: r.source,
    categorySlug: r.categorySlug,
    city: r.city,
    status: r.status,
    fetched: r.fetched,
    inserted: r.inserted,
    updated: r.updated,
    skipped: r.skipped,
    errors: r.errors,
    errorMessage: r.errorMessage,
    startedAt: r.startedAt.toISOString(),
    finishedAt: r.finishedAt?.toISOString() ?? null,
  };
}

export function serializeContactCandidate(candidate: Record<string, unknown>) {
  return {
    id: candidate["id"],
    businessId: candidate["businessId"],
    fullName: candidate["fullName"] ?? null,
    role: candidate["role"] ?? null,
    contactType: candidate["contactType"],
    email: candidate["email"] ?? null,
    phone: candidate["phone"] ?? null,
    contactUrl: candidate["contactUrl"] ?? null,
    sourceUrl: candidate["sourceUrl"],
    sourceType: candidate["sourceType"],
    confidenceScore: candidate["confidenceScore"],
    isPrimary: candidate["isPrimary"],
    isPersonalData: candidate["isPersonalData"],
    lastVerifiedAt: (candidate["lastVerifiedAt"] as Date | null | undefined)?.toISOString() ?? null,
    verificationStatus: candidate["verificationStatus"],
    isReachable: candidate["isReachable"],
    isDecisionMakerLikely: candidate["isDecisionMakerLikely"],
    channelPriority: candidate["channelPriority"],
    sourcePriority: candidate["sourcePriority"],
    nextVerificationAt:
      (candidate["nextVerificationAt"] as Date | null | undefined)?.toISOString() ?? null,
    reviewStatus: candidate["reviewStatus"],
    notes: candidate["notes"] ?? null,
    createdAt: (candidate["createdAt"] as Date).toISOString(),
    updatedAt: (candidate["updatedAt"] as Date).toISOString(),
  };
}
