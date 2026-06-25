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

export const businessesCatalogRouter = Router();

businessesCatalogRouter.get("/categories", async (_req, res) => {
  const rows = await db.select().from(categoriesTable).orderBy(categoriesTable.label);
  res.json(rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    label: r.label,
    description: r.description ?? null,
    osmTags: r.osmTags,
    active: r.active,
    createdAt: r.createdAt.toISOString(),
  })));
});

businessesCatalogRouter.get("/businesses", async (req, res) => {
  const {
    page = "1",
    pageSize = "50",
  } = req.query as Record<string, string | undefined>;

  const pageNum = Math.max(1, parseInt(page ?? "1", 10));
  const size = Math.min(100, Math.max(1, parseInt(pageSize ?? "50", 10)));
  const offset = (pageNum - 1) * size;
  const where = buildBusinessFilters(req.query as Record<string, string | undefined>);

  const [rows, totalResult] = await Promise.all([
    db
      .select()
      .from(businessesTable)
      .where(where)
      .orderBy(
        desc(businessesTable.readyForOutreach),
        desc(businessesTable.actionabilityScore),
        desc(businessesTable.priorityScore),
        businessesTable.name,
      )
      .limit(size)
      .offset(offset),
    db.select({ count: count() }).from(businessesTable).where(where),
  ]);

  let normalizedRows = rows;
  const rowsNeedingRefresh = rows
    .filter((row) => row.priorityScore == null || row.lastResearchAt == null)
    .map((row) => row.id);
  if (rowsNeedingRefresh.length > 0) {
    const refreshed = await refreshBusinessResearchStates(rowsNeedingRefresh);
    if (refreshed.length > 0) {
      const refreshedById = new Map(
        refreshed
          .map((entry) => entry.business)
          .filter((business): business is NonNullable<typeof business> => Boolean(business))
          .map((business) => [business.id, business]),
      );
      normalizedRows = rows.map((row) => refreshedById.get(row.id) ?? row);
    }
  }

  const total = Number(totalResult[0]?.count ?? 0);
  res.json({
    businesses: normalizedRows.map(serializeBusiness),
    total,
    page: pageNum,
    pageSize: size,
    totalPages: Math.ceil(total / size),
  });
});

businessesCatalogRouter.get("/businesses/:id", async (req, res) => {
  const id = parseInt(String(req.params["id"] ?? "0"), 10);
  if (!id || isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const refreshed = await refreshBusinessResearchState(id);
  if (!refreshed?.business) {
    const rows = await db.select().from(businessesTable).where(eq(businessesTable.id, id)).limit(1);
    if (rows.length === 0) { res.status(404).json({ error: "Business not found" }); return; }
    res.json(serializeBusiness(rows[0]!));
    return;
  }

  res.json(serializeBusiness(refreshed.business));
});

businessesCatalogRouter.get("/businesses/:id/sources", async (req, res) => {
  const id = parseInt(String(req.params["id"] ?? "0"), 10);
  if (!id || isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const business = await db
    .select({ id: businessesTable.id })
    .from(businessesTable)
    .where(eq(businessesTable.id, id))
    .limit(1);

  if (business.length === 0) {
    res.status(404).json({ error: "Business not found" });
    return;
  }

  const sources = await getBusinessSources(id);
  res.json(
    sources.map((source) => ({
      id: source.id,
      businessId: source.businessId,
      sourceType: source.sourceType,
      sourceUrl: source.sourceUrl,
      sourceDomain: source.sourceDomain ?? null,
      discoveredVia: source.discoveredVia ?? null,
      fetchStatus: source.fetchStatus,
      lastFetchedAt: source.lastFetchedAt?.toISOString() ?? null,
      contentHash: source.contentHash ?? null,
      sourcePayloadSummary: source.sourcePayloadSummary ?? null,
      sourceLicense: source.sourceLicense ?? null,
      sourceAttribution: source.sourceAttribution ?? null,
      sourceRateLimitBucket: source.sourceRateLimitBucket ?? null,
      httpStatus: source.httpStatus ?? null,
      isOfficial: source.isOfficial,
      sourcePriority: source.sourcePriority,
      usefulnessScore: source.usefulnessScore ?? null,
      nextFetchAt: source.nextFetchAt?.toISOString() ?? null,
      freshnessStatus: source.freshnessStatus,
      createdAt: source.createdAt.toISOString(),
      updatedAt: source.updatedAt.toISOString(),
    })),
  );
});

businessesCatalogRouter.get("/stats", async (req, res) => {
  const { categorySlug } = req.query as { categorySlug?: string };
  const where = categorySlug ? eq(businessesTable.categorySlug, categorySlug) : undefined;

  const [totals, byCategoryRaw, byCityRaw] = await Promise.all([
    db.select({
      total: count(),
      withWebsite: sql<number>`count(*) filter (where has_website = true)`,
      withPhone: sql<number>`count(*) filter (where has_phone = true)`,
      enriched: sql<number>`count(*) filter (where enrichment_status = 'enriched')`,
    }).from(businessesTable).where(where),
    db.select({ categorySlug: businessesTable.categorySlug, count: count() })
      .from(businessesTable)
      .groupBy(businessesTable.categorySlug)
      .orderBy(desc(count())),
    db.select({ city: businessesTable.city, count: count() })
      .from(businessesTable)
      .where(where)
      .groupBy(businessesTable.city)
      .orderBy(desc(count())),
  ]);

  const t = totals[0] ?? { total: 0, withWebsite: 0, withPhone: 0, enriched: 0 };
  res.json({
    totalBusinesses: Number(t.total),
    withWebsite: Number(t.withWebsite),
    withPhone: Number(t.withPhone),
    enriched: Number(t.enriched),
    byCategoryBreakdown: byCategoryRaw.map((r) => ({ categorySlug: r.categorySlug, count: Number(r.count) })),
    byCityBreakdown: byCityRaw.map((r) => ({ city: r.city, count: Number(r.count) })),
  });
});

businessesCatalogRouter.get("/galleries", async (req, res) => {
  const newUrl = `/api/businesses?categorySlug=art_gallery&${new URLSearchParams(req.query as Record<string, string>).toString()}`;
  res.redirect(301, newUrl);
});
