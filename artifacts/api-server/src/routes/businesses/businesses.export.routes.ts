import { Router } from "express";
import { db, businessesTable, importRunsTable, categoriesTable, contactCandidatesTable } from "@workspace/db";
import { and, count, desc, eq, gte, ilike, ne, or, sql } from "drizzle-orm";
import { queueImportRun } from "../../services/importJobService";
import { getBusinessSources } from "../../services/businessSourceService";
import { getContactCandidates } from "../../services/contactCandidateService";
import { getOutreachEvents, recordContactCandidateUpdate, recordOutreachUpdate } from "../../services/outreachAuditService";
import { previewBusinessResearchSnapshots, refreshBusinessResearchState, refreshBusinessResearchStates } from "../../services/businessResearchPersistenceService";
import { getResearchMetrics } from "../../services/researchMetricsService";
import { getReviewBuckets, getReviewQueue } from "../../services/reviewQueueService";
import { enqueueResearchJob, listResearchJobs } from "../../services/researchJobService";
import { runResearchAutomationTick } from "../../services/researchAutomationService";
import { createResearchView, deleteResearchView, listResearchViews, updateResearchView } from "../../services/researchViewService";
import { ASSIGNED_ARTISTS, ASSIGNED_ARTIST_SOURCES, AVATAR_TYPES, CONTACT_CANDIDATE_STATUSES, OUTREACH_STATUSES, RESEARCH_JOB_TYPES_SET, TARGET_MARKETS, buildBusinessFilters, buildCsv, buildOutreachPipelineItems, compareDateStrings, filterOutreachRows, getOutreachRows, getTodayDateString, normalizeNullableDateString, normalizeNullableString, parseOptionalNumber, serializeBusiness, serializeBusinessOutreach, serializeContactCandidate, serializeImportRun } from "./businesses.shared";

export const businessesExportRouter = Router();

businessesExportRouter.get("/export/businesses.csv", async (req, res) => {
  const where = buildBusinessFilters(req.query as Record<string, string | undefined>);
  const rows = await db
    .select()
    .from(businessesTable)
    .where(where)
    .orderBy(desc(businessesTable.readyForOutreach), desc(businessesTable.priorityScore), businessesTable.name);

  const headers = [
    "id", "categoria", "nome", "citta", "indirizzo", "cap", "latitudine", "longitudine",
    "sito_web", "telefono", "osm_id", "rating", "valutazioni_totali",
    "stato_arricchimento", "ha_sito_web", "ha_telefono",
    "stato_outreach", "contatto_nome", "contatto_ruolo", "contatto_email",
    "ultima_data_contatto", "prossima_azione",
    "artista_assegnato", "fonte_assegnazione_artista",
    "tipo_avatar", "mercato_target", "connessione_calda", "note",
    "relevance_score", "contactability_score", "confidence_score", "freshness_score",
    "priority_score", "research_score", "ready_for_outreach", "review_required",
    "review_reason", "top_gap", "recommended_next_step",
    "creato_il", "aggiornato_il",
  ];

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="businesses.csv"');
  res.send(
    buildCsv(
      headers,
      rows.map((r) => [
        r.id, r.categorySlug, r.name, r.city, r.addressLine, r.postalCode,
        r.latitude, r.longitude, r.website, r.phone, r.osmId,
        r.rating, r.userRatingsTotal,
        r.enrichmentStatus, r.hasWebsite ? "sì" : "no", r.hasPhone ? "sì" : "no",
        r.outreachStatus, r.contactName, r.contactRole, r.contactEmail,
        r.lastContactDate, r.nextActionDate,
        r.assignedArtist, r.assignedArtistSource,
        r.avatarType, r.targetMarket, r.warmConnection, r.notes,
        r.relevanceScore, r.contactabilityScore, r.confidenceScore, r.freshnessScore,
        r.priorityScore, r.researchScore, r.readyForOutreach ? "true" : "false",
        r.reviewRequired ? "true" : "false", r.reviewReason, r.topGap, r.recommendedNextStep,
        r.createdAt.toISOString(), r.updatedAt.toISOString(),
      ]),
    ),
  );
});

businessesExportRouter.get("/export/business-research-summary.csv", async (req, res) => {
  const where = buildBusinessFilters(req.query as Record<string, string | undefined>);
  const rows = await db
    .select()
    .from(businessesTable)
    .where(where)
    .orderBy(desc(businessesTable.readyForOutreach), desc(businessesTable.priorityScore), businessesTable.name);

  const businessIds = rows.map((row) => row.id);
  await refreshBusinessResearchStates(businessIds);
  const previews = await previewBusinessResearchSnapshots(businessIds);
  const previewByBusinessId = new Map(previews.map((entry) => [entry.aggregate.business.id, entry]));

  const headers = [
    "business_id", "business_name", "city", "country", "category_slug", "avatar_type",
    "target_market", "website", "phone", "official_source_count", "successful_source_count",
    "failed_source_count", "has_official_website", "has_contact_email", "has_primary_contact",
    "primary_contact_type", "primary_contact_value", "primary_source_type", "primary_source_url",
    "source_health", "contact_readiness", "relevance_score", "contactability_score",
    "confidence_score", "freshness_score", "priority_score", "research_score",
    "ready_for_outreach", "review_required", "review_reason", "top_gap",
    "recommended_next_step", "discovery_status", "qualification_status",
    "contactability_status", "ranking_status", "last_research_at", "next_research_at",
  ];

  const exportRows = rows.map((row) => {
    const preview = previewByBusinessId.get(row.id);
    const snapshot = preview?.snapshot;
    return [
      row.id,
      row.name,
      row.city,
      row.country,
      row.categorySlug,
      row.avatarType,
      row.targetMarket,
      row.website,
      row.phone,
      snapshot?.officialSourceCount ?? row.officialSourceCount,
      snapshot?.successfulSourceCount ?? row.successfulSourceCount,
      snapshot?.failedSourceCount ?? row.failedSourceCount,
      (snapshot?.officialSourceCount ?? row.officialSourceCount ?? 0) > 0 ? "true" : "false",
      row.contactEmail ? "true" : "false",
      snapshot?.primaryContactCandidateId ? "true" : "false",
      snapshot?.primaryContactType,
      snapshot?.primaryContactValue,
      snapshot?.primarySourceType,
      snapshot?.primarySourceUrl,
      snapshot?.sourceHealth ?? row.sourceHealth,
      snapshot?.contactReadiness ?? row.contactReadiness,
      snapshot?.relevanceScore ?? row.relevanceScore,
      snapshot?.contactabilityScore ?? row.contactabilityScore,
      snapshot?.confidenceScore ?? row.confidenceScore,
      snapshot?.freshnessScore ?? row.freshnessScore,
      snapshot?.priorityScore ?? row.priorityScore,
      snapshot?.researchScore ?? row.researchScore,
      (snapshot?.readyForOutreach ?? row.readyForOutreach) ? "true" : "false",
      (snapshot?.reviewRequired ?? row.reviewRequired) ? "true" : "false",
      snapshot?.reviewReason ?? row.reviewReason,
      snapshot?.topGap ?? row.topGap,
      snapshot?.recommendedNextStep ?? row.recommendedNextStep,
      snapshot?.discoveryStatus ?? row.discoveryStatus,
      snapshot?.qualificationStatus ?? row.qualificationStatus,
      snapshot?.contactabilityStatus ?? row.contactabilityStatus,
      snapshot?.rankingStatus ?? row.rankingStatus,
      (snapshot?.lastResearchAt ?? row.lastResearchAt)?.toISOString?.() ?? null,
      (snapshot?.nextResearchAt ?? row.nextResearchAt)?.toISOString?.() ?? null,
    ];
  });

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="business_research_summary.csv"');
  res.send(buildCsv(headers, exportRows));
});

businessesExportRouter.get("/export/outreach-ready.csv", async (req, res) => {
  const baseQuery = req.query as Record<string, string | undefined>;
  const where = buildBusinessFilters({
    ...baseQuery,
    readyForOutreach: undefined,
    reviewRequired: undefined,
  });

  const rows = await db
    .select()
    .from(businessesTable)
    .where(where)
    .orderBy(desc(businessesTable.priorityScore), businessesTable.name);

  await refreshBusinessResearchStates(rows.map((row) => row.id));
  const previews = await previewBusinessResearchSnapshots(rows.map((row) => row.id));
  const previewByBusinessId = new Map(previews.map((entry) => [entry.aggregate.business.id, entry]));

  const headers = [
    "business_id", "business_name", "city", "country", "category_slug", "avatar_type",
    "target_market", "assigned_artist", "assigned_artist_source", "website", "phone",
    "contact_name", "contact_role", "contact_type", "contact_value", "contact_source_type",
    "contact_source_url", "is_primary_contact", "relevance_score", "contactability_score",
    "confidence_score", "priority_score", "ready_for_outreach", "outreach_status",
    "last_contact_date", "next_action_date", "warm_connection", "review_required",
    "review_reason", "recommended_next_step", "notes", "last_research_at",
  ];

  const exportRows = rows
    .filter((row) => {
      const preview = previewByBusinessId.get(row.id);
      return preview?.snapshot.readyForOutreach || row.outreachStatus !== "not_contacted";
    })
    .map((row) => {
    const preview = previewByBusinessId.get(row.id);
    const primaryCandidate = preview?.aggregate.contactCandidates.find(
      (candidate) => candidate.id === preview.snapshot.primaryContactCandidateId,
    );

    return [
      row.id,
      row.name,
      row.city,
      row.country,
      row.categorySlug,
      row.avatarType,
      row.targetMarket,
      row.assignedArtist,
      row.assignedArtistSource,
      row.website,
      row.phone,
      row.contactName ?? preview?.snapshot.primaryContactName,
      row.contactRole ?? preview?.snapshot.primaryContactRole,
      preview?.snapshot.primaryContactType,
      preview?.snapshot.primaryContactValue,
      primaryCandidate?.sourceType ?? null,
      primaryCandidate?.sourceUrl ?? null,
      preview?.snapshot.primaryContactCandidateId ? "true" : "false",
      preview?.snapshot.relevanceScore ?? row.relevanceScore,
      preview?.snapshot.contactabilityScore ?? row.contactabilityScore,
      preview?.snapshot.confidenceScore ?? row.confidenceScore,
      preview?.snapshot.priorityScore ?? row.priorityScore,
      (preview?.snapshot.readyForOutreach ?? row.readyForOutreach) ? "true" : "false",
      row.outreachStatus,
      row.lastContactDate,
      row.nextActionDate,
      row.warmConnection,
      (preview?.snapshot.reviewRequired ?? row.reviewRequired) ? "true" : "false",
      preview?.snapshot.reviewReason ?? row.reviewReason,
      preview?.snapshot.recommendedNextStep ?? row.recommendedNextStep,
      row.notes,
      preview?.snapshot.lastResearchAt?.toISOString?.() ?? row.lastResearchAt?.toISOString?.() ?? null,
    ];
    });

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="outreach_ready.csv"');
  res.send(buildCsv(headers, exportRows));
});

businessesExportRouter.get("/export/review-queue.csv", async (req, res) => {
  const baseQuery = req.query as Record<string, string | undefined>;
  const where = buildBusinessFilters({
    ...baseQuery,
    readyForOutreach: undefined,
    reviewRequired: undefined,
  });

  const rows = await db
    .select()
    .from(businessesTable)
    .where(where)
    .orderBy(desc(businessesTable.priorityScore), businessesTable.name);

  await refreshBusinessResearchStates(rows.map((row) => row.id));
  const previews = await previewBusinessResearchSnapshots(rows.map((row) => row.id));
  const previewByBusinessId = new Map(previews.map((entry) => [entry.aggregate.business.id, entry]));

  const headers = [
    "business_id", "business_name", "city", "country", "category_slug", "avatar_type",
    "target_market", "website", "primary_source_type", "primary_source_url",
    "official_source_count", "successful_source_count", "failed_source_count",
    "contact_type", "contact_value", "contact_confidence_score", "relevance_score",
    "contactability_score", "confidence_score", "priority_score", "review_required",
    "review_reason", "review_bucket", "top_gap", "recommended_next_step", "research_depth",
    "ready_for_outreach", "outreach_status", "warm_connection", "last_research_at", "next_research_at",
  ];

  const exportRows = rows
    .filter((row) => {
      const preview = previewByBusinessId.get(row.id);
      return Boolean(preview?.snapshot.reviewRequired) && !preview?.snapshot.readyForOutreach;
    })
    .map((row) => {
    const preview = previewByBusinessId.get(row.id);
    const primaryCandidate = preview?.aggregate.contactCandidates.find(
      (candidate) => candidate.id === preview.snapshot.primaryContactCandidateId,
    );
    const researchDepth = preview?.snapshot.primaryContactCandidateId
      ? "L3"
      : preview?.snapshot.primarySourceId
        ? "L1"
        : "L0";

    return [
      row.id,
      row.name,
      row.city,
      row.country,
      row.categorySlug,
      row.avatarType,
      row.targetMarket,
      row.website,
      preview?.snapshot.primarySourceType,
      preview?.snapshot.primarySourceUrl,
      preview?.snapshot.officialSourceCount ?? row.officialSourceCount,
      preview?.snapshot.successfulSourceCount ?? row.successfulSourceCount,
      preview?.snapshot.failedSourceCount ?? row.failedSourceCount,
      preview?.snapshot.primaryContactType,
      preview?.snapshot.primaryContactValue,
      primaryCandidate?.confidenceScore ?? null,
      preview?.snapshot.relevanceScore ?? row.relevanceScore,
      preview?.snapshot.contactabilityScore ?? row.contactabilityScore,
      preview?.snapshot.confidenceScore ?? row.confidenceScore,
      preview?.snapshot.priorityScore ?? row.priorityScore,
      (preview?.snapshot.reviewRequired ?? row.reviewRequired) ? "true" : "false",
      preview?.snapshot.reviewReason ?? row.reviewReason,
      preview?.snapshot.reviewReason ?? row.reviewReason,
      preview?.snapshot.topGap ?? row.topGap,
      preview?.snapshot.recommendedNextStep ?? row.recommendedNextStep,
      researchDepth,
      (preview?.snapshot.readyForOutreach ?? row.readyForOutreach) ? "true" : "false",
      row.outreachStatus,
      row.warmConnection,
      preview?.snapshot.lastResearchAt?.toISOString?.() ?? row.lastResearchAt?.toISOString?.() ?? null,
      preview?.snapshot.nextResearchAt?.toISOString?.() ?? row.nextResearchAt?.toISOString?.() ?? null,
    ];
    });

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="review_queue.csv"');
  res.send(buildCsv(headers, exportRows));
});

async function exportSlgBusinessCsv(
  req: any,
  res: any,
  options: {
    filename: string;
    engineType?: string;
    targetCluster?: string;
    extraWhere?: any;
  },
) {
  const where = buildBusinessFilters(req.query as Record<string, string | undefined>);
  const conditions = [
    where,
    options.engineType ? eq(businessesTable.engineType, options.engineType) : undefined,
    options.targetCluster ? eq(businessesTable.targetCluster, options.targetCluster) : undefined,
    options.extraWhere,
  ].filter((condition): condition is NonNullable<typeof condition> => Boolean(condition));
  const rows = await db
    .select()
    .from(businessesTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(businessesTable.actionabilityScore), desc(businessesTable.priorityScore), businessesTable.name);

  const headers = [
    "business_id",
    "business_name",
    "engine_type",
    "target_type",
    "target_cluster",
    "city",
    "country",
    "target_market",
    "best_offer_id",
    "best_narrative_id",
    "best_credibility_asset_id",
    "best_case_study_id",
    "economic_value_score",
    "strategic_value_score",
    "referral_value_score",
    "prestige_value_score",
    "continuity_revenue_potential",
    "offer_fit_score",
    "relationship_path_score",
    "actionability_score",
    "priority_score",
    "research_score",
    "recommended_next_step",
    "next_best_contact_window",
    "warm_path_exists",
    "ready_for_outreach",
    "ready_for_relationship",
    "ready_for_institutional_pitch",
    "prestige_watchlist",
    "cultivation_required",
  ];

  const exportRows = rows.map((row) => [
    row.id,
    row.name,
    row.engineType ?? "",
    row.targetType ?? "",
    row.targetCluster ?? "",
    row.city ?? "",
    row.country ?? "",
    row.targetMarket ?? "",
    row.bestOfferId ?? "",
    row.bestNarrativeId ?? "",
    row.bestCredibilityAssetId ?? "",
    row.bestCaseStudyId ?? "",
    row.economicValueScore ?? "",
    row.strategicValueScore ?? "",
    row.referralValueScore ?? "",
    row.prestigeValueScore ?? "",
    row.continuityRevenuePotential ?? "",
    row.offerFitScore ?? "",
    row.relationshipPathScore ?? "",
    row.actionabilityScore ?? "",
    row.priorityScore ?? "",
    row.researchScore ?? "",
    row.recommendedNextStep ?? "",
    row.nextBestContactWindow ?? "",
    row.warmPathExists ? "true" : "false",
    row.readyForOutreach ? "true" : "false",
    row.readyForRelationship ? "true" : "false",
    row.readyForInstitutionalPitch ? "true" : "false",
    row.prestigeWatchlist ? "true" : "false",
    row.cultivationRequired ? "true" : "false",
  ]);

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${options.filename}"`);
  res.send(buildCsv(headers, exportRows));
}

businessesExportRouter.get("/export/slg-revenue-targets.csv", async (req, res) => {
  await exportSlgBusinessCsv(req, res, {
    filename: "slg_revenue_targets.csv",
    engineType: "revenue",
  });
});

businessesExportRouter.get("/export/slg-institutional-targets.csv", async (req, res) => {
  await exportSlgBusinessCsv(req, res, {
    filename: "slg_institutional_targets.csv",
    engineType: "institutional",
  });
});

businessesExportRouter.get("/export/slg-authority-targets.csv", async (req, res) => {
  await exportSlgBusinessCsv(req, res, {
    filename: "slg_authority_targets.csv",
    engineType: "authority",
  });
});

businessesExportRouter.get("/export/slg-referral-paths.csv", async (req, res) => {
  await exportSlgBusinessCsv(req, res, {
    filename: "slg_referral_paths.csv",
    extraWhere: eq(businessesTable.warmPathExists, true),
  });
});

businessesExportRouter.get("/export/slg-labirinto-fit.csv", async (req, res) => {
  await exportSlgBusinessCsv(req, res, {
    filename: "slg_labirinto_fit.csv",
    targetCluster: "residency_exchange_diplomacy",
  });
});

businessesExportRouter.get("/export/slg-hospitality-targets.csv", async (req, res) => {
  await exportSlgBusinessCsv(req, res, {
    filename: "slg_hospitality_targets.csv",
    targetCluster: "boutique_hotel_hospitality",
  });
});
