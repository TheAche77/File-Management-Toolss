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
import { enqueueResearchJob, listResearchJobs, RESEARCH_JOB_TYPES } from "../../services/researchJobService";
import { runResearchAutomationTick } from "../../services/researchAutomationService";
import { createResearchView, deleteResearchView, listResearchViews, updateResearchView } from "../../services/researchViewService";
import { requireAdminAuth } from "../../lib/adminAuth";
import { ASSIGNED_ARTISTS, ASSIGNED_ARTIST_SOURCES, AVATAR_TYPES, CONTACT_CANDIDATE_STATUSES, OUTREACH_STATUSES, RESEARCH_JOB_TYPES_SET, TARGET_MARKETS, buildBusinessFilters, buildCsv, buildOutreachPipelineItems, compareDateStrings, filterOutreachRows, getOutreachRows, getTodayDateString, normalizeNullableDateString, normalizeNullableString, parseOptionalBoolean, parseOptionalNumber, serializeBusiness, serializeBusinessOutreach, serializeContactCandidate, serializeImportRun } from "./businesses.shared";

export const businessesResearchRouter = Router();

businessesResearchRouter.get("/businesses/review-queue", requireAdminAuth, async (req, res) => {
  const {
    categorySlug,
    city,
    targetMarket,
    limit = "25",
  } = req.query as Record<string, string | undefined>;

  const items = await getReviewQueue({
    categorySlug,
    city,
    targetMarket,
    limit: parseInt(limit ?? "25", 10),
  });

  res.json(
    items.map((item) => ({
      business: serializeBusiness(item.business),
      reasons: item.reasons,
      priorityScore: item.priorityScore,
      sourceCount: item.sourceCount,
      officialSourceCount: item.officialSourceCount,
      failedSourceCount: item.failedSourceCount,
    })),
  );
});

businessesResearchRouter.get("/research/feed", requireAdminAuth, async (req, res) => {
  const {
    page = "1",
    pageSize = "25",
  } = req.query as Record<string, string | undefined>;

  const pageNum = Math.max(1, parseInt(page ?? "1", 10));
  const size = Math.min(100, Math.max(1, parseInt(pageSize ?? "25", 10)));
  const offset = (pageNum - 1) * size;
  const where = buildBusinessFilters(req.query as Record<string, string | undefined>);

  const [rows, totalResult] = await Promise.all([
    db
      .select()
      .from(businessesTable)
      .where(where)
      .orderBy(
        desc(businessesTable.actionabilityScore),
        desc(businessesTable.researchScore),
        desc(businessesTable.priorityScore),
        businessesTable.name,
      )
      .limit(size)
      .offset(offset),
    db.select({ count: count() }).from(businessesTable).where(where),
  ]);

  res.json({
    businesses: rows.map(serializeBusiness),
    total: Number(totalResult[0]?.count ?? 0),
    page: pageNum,
    pageSize: size,
    totalPages: Math.ceil(Number(totalResult[0]?.count ?? 0) / size),
  });
});

businessesResearchRouter.get("/research/metrics", requireAdminAuth, async (req, res) => {
  const {
    categorySlug,
    city,
    targetMarket,
    engineType,
    targetType,
    targetCluster,
    warmPathExists,
    readyForRelationship,
    readyForInstitutionalPitch,
    prestigeWatchlist,
    cultivationRequired,
  } = req.query as Record<string, string | undefined>;
  const metrics = await getResearchMetrics({
    categorySlug,
    city,
    targetMarket,
    engineType,
    targetType,
    targetCluster,
    warmPathExists: parseOptionalBoolean(warmPathExists),
    readyForRelationship: parseOptionalBoolean(readyForRelationship),
    readyForInstitutionalPitch: parseOptionalBoolean(readyForInstitutionalPitch),
    prestigeWatchlist: parseOptionalBoolean(prestigeWatchlist),
    cultivationRequired: parseOptionalBoolean(cultivationRequired),
  });
  res.json(metrics);
});

businessesResearchRouter.get("/research/review-buckets", requireAdminAuth, async (req, res) => {
  const {
    categorySlug,
    city,
    targetMarket,
    engineType,
    targetType,
    targetCluster,
    warmPathExists,
    readyForRelationship,
    readyForInstitutionalPitch,
    prestigeWatchlist,
    cultivationRequired,
    limit = "100",
  } = req.query as Record<string, string | undefined>;
  const buckets = await getReviewBuckets({
    categorySlug,
    city,
    targetMarket,
    engineType,
    targetType,
    targetCluster,
    warmPathExists: parseOptionalBoolean(warmPathExists),
    readyForRelationship: parseOptionalBoolean(readyForRelationship),
    readyForInstitutionalPitch: parseOptionalBoolean(readyForInstitutionalPitch),
    prestigeWatchlist: parseOptionalBoolean(prestigeWatchlist),
    cultivationRequired: parseOptionalBoolean(cultivationRequired),
    limit: parseInt(limit ?? "100", 10),
  });

  res.json(
    buckets.map((bucket) => ({
      key: bucket.key,
      label: bucket.label,
      count: bucket.items.length,
      items: bucket.items.map((item) => ({
        business: serializeBusiness(item.business),
        reasons: item.reasons,
        priorityScore: item.priorityScore,
        sourceCount: item.sourceCount,
        officialSourceCount: item.officialSourceCount,
        failedSourceCount: item.failedSourceCount,
      })),
    })),
  );
});

businessesResearchRouter.get("/research/jobs", requireAdminAuth, async (req, res) => {
  const { status, limit = "50" } = req.query as Record<string, string | undefined>;
  const jobs = await listResearchJobs({
    status,
    limit: parseInt(limit ?? "50", 10),
  });

  res.json(
    jobs.map((job) => ({
      id: job.id,
      jobType: job.jobType,
      businessId: job.businessId ?? null,
      sourceId: job.sourceId ?? null,
      status: job.status,
      priority: job.priority,
      scheduledAt: job.scheduledAt?.toISOString() ?? null,
      startedAt: job.startedAt?.toISOString() ?? null,
      finishedAt: job.finishedAt?.toISOString() ?? null,
      attemptCount: job.attemptCount,
      errorCode: job.errorCode ?? null,
      errorMessage: job.errorMessage ?? null,
      payload: job.payload ?? null,
      resultSummary: job.resultSummary ?? null,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
    })),
  );
});

businessesResearchRouter.post("/research/jobs", requireAdminAuth, async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const jobType = normalizeNullableString(body["jobType"]);
  const businessId = Number(body["businessId"] ?? 0);
  const sourceId = Number(body["sourceId"] ?? 0);
  const priority = Number(body["priority"] ?? 50);

  if (!jobType) {
    res.status(400).json({ error: "jobType is required" });
    return;
  }
  if (!RESEARCH_JOB_TYPES_SET.has(jobType as (typeof RESEARCH_JOB_TYPES)[number])) {
    res.status(400).json({ error: "Invalid research job type" });
    return;
  }

  const job = await enqueueResearchJob({
    jobType: jobType as (typeof RESEARCH_JOB_TYPES)[number],
    businessId: Number.isFinite(businessId) && businessId > 0 ? businessId : null,
    sourceId: Number.isFinite(sourceId) && sourceId > 0 ? sourceId : null,
    priority: Number.isFinite(priority) ? priority : 50,
    payload: typeof body["payload"] === "object" && body["payload"] ? (body["payload"] as Record<string, unknown>) : undefined,
  });

  res.status(201).json(job);
});

businessesResearchRouter.post("/research/jobs/run", requireAdminAuth, async (_req, res) => {
  await runResearchAutomationTick();
  res.json({ ok: true });
});

businessesResearchRouter.get("/research/views", requireAdminAuth, async (_req, res) => {
  const views = await listResearchViews();
  res.json(
    views.map((view) => ({
      id: view.id,
      name: view.name,
      scope: view.scope,
      isDefault: view.isDefault,
      filtersJson: view.filtersJson,
      sortJson: view.sortJson,
      createdAt: view.createdAt.toISOString(),
      updatedAt: view.updatedAt.toISOString(),
    })),
  );
});

businessesResearchRouter.post("/research/views", requireAdminAuth, async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const name = normalizeNullableString(body["name"]);
  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }

  const created = await createResearchView({
    name,
    scope: normalizeNullableString(body["scope"]) ?? "global",
    isDefault: body["isDefault"] === true,
    filtersJson:
      typeof body["filtersJson"] === "object" && body["filtersJson"]
        ? (body["filtersJson"] as Record<string, unknown>)
        : {},
    sortJson:
      typeof body["sortJson"] === "object" && body["sortJson"]
        ? (body["sortJson"] as Record<string, unknown>)
        : {},
  });

  res.status(201).json(created);
});

businessesResearchRouter.patch("/research/views/:id", requireAdminAuth, async (req, res) => {
  const id = parseInt(String(req.params["id"] ?? "0"), 10);
  if (!id || Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid view identifier" });
    return;
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const updated = await updateResearchView(id, {
    name: normalizeNullableString(body["name"]) ?? undefined,
    scope: normalizeNullableString(body["scope"]) ?? undefined,
    isDefault: typeof body["isDefault"] === "boolean" ? body["isDefault"] : undefined,
    filtersJson:
      typeof body["filtersJson"] === "object" && body["filtersJson"]
        ? (body["filtersJson"] as Record<string, unknown>)
        : undefined,
    sortJson:
      typeof body["sortJson"] === "object" && body["sortJson"]
        ? (body["sortJson"] as Record<string, unknown>)
        : undefined,
  });

  if (!updated) {
    res.status(404).json({ error: "Research view not found" });
    return;
  }

  res.json(updated);
});

businessesResearchRouter.delete("/research/views/:id", requireAdminAuth, async (req, res) => {
  const id = parseInt(String(req.params["id"] ?? "0"), 10);
  if (!id || Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid view identifier" });
    return;
  }

  const deleted = await deleteResearchView(id);
  if (!deleted) {
    res.status(404).json({ error: "Research view not found" });
    return;
  }

  res.status(204).end();
});

businessesResearchRouter.post("/businesses/:id/research/refresh", requireAdminAuth, async (req, res) => {
  const businessId = parseInt(String(req.params["id"] ?? "0"), 10);
  if (!businessId || isNaN(businessId)) {
    res.status(400).json({ error: "Invalid business identifier" });
    return;
  }

  const refreshed = await refreshBusinessResearchState(businessId);
  if (!refreshed?.business) {
    res.status(404).json({ error: "Business not found" });
    return;
  }

  res.json(serializeBusiness(refreshed.business));
});

businessesResearchRouter.post("/research/refresh", requireAdminAuth, async (req, res) => {
  const body = (req.body ?? {}) as { businessIds?: number[] };

  let businessIds = Array.isArray(body.businessIds)
    ? body.businessIds.filter((value): value is number => Number.isFinite(value))
    : [];

  if (businessIds.length === 0) {
    const rows = await db.select({ id: businessesTable.id }).from(businessesTable);
    businessIds = rows.map((row) => row.id);
  }

  const refreshed = await refreshBusinessResearchStates(businessIds);
  res.json({
    refreshed: refreshed.length,
    businessIds,
  });
});
