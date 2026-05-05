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
import { requireAdminAuth } from "../../lib/adminAuth";
import { ASSIGNED_ARTISTS, ASSIGNED_ARTIST_SOURCES, AVATAR_TYPES, CONTACT_CANDIDATE_STATUSES, OUTREACH_STATUSES, RESEARCH_JOB_TYPES_SET, TARGET_MARKETS, buildBusinessFilters, buildCsv, buildOutreachPipelineItems, compareDateStrings, filterOutreachRows, getOutreachRows, getTodayDateString, normalizeNullableDateString, normalizeNullableString, parseOptionalNumber, serializeBusiness, serializeBusinessOutreach, serializeContactCandidate, serializeImportRun } from "./businesses.shared";

export const businessesImportRouter = Router();

businessesImportRouter.post("/imports/run", requireAdminAuth, async (req, res) => {
  const { categorySlug, city } = req.body as { categorySlug?: string; city?: string };
  if (!categorySlug || !city) {
    res.status(400).json({ error: "categorySlug and city are required" });
    return;
  }

  const category = await db
    .select({ id: categoriesTable.id })
    .from(categoriesTable)
    .where(eq(categoriesTable.slug, categorySlug))
    .limit(1);

  if (category.length === 0) {
    res.status(400).json({ error: `Unknown category: ${categorySlug}` });
    return;
  }

  req.log.info({ categorySlug, city }, "Queueing import");
  const queued = await queueImportRun(categorySlug, city);

  if (!queued.accepted) {
    res.status(409).json({ error: `An import is already active for ${categorySlug} in ${city}. Run ID: ${queued.runId}` });
    return;
  }

  res.status(202).json({
    success: true,
    queued: true,
    status: queued.status,
    fetched: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    message: `Import queued for ${city}`,
    runId: queued.runId,
  });
});

businessesImportRouter.get("/imports/runs", requireAdminAuth, async (_req, res) => {
  const runs = await db
    .select()
    .from(importRunsTable)
    .orderBy(desc(importRunsTable.startedAt))
    .limit(50);

  res.json(runs.map(serializeImportRun));
});

businessesImportRouter.get("/imports/runs/:id", requireAdminAuth, async (req, res) => {
  const id = parseInt(String(req.params["id"] ?? "0"), 10);
  if (!id || isNaN(id)) {
    res.status(400).json({ error: "Invalid run ID" });
    return;
  }

  const runs = await db
    .select()
    .from(importRunsTable)
    .where(eq(importRunsTable.id, id))
    .limit(1);

  if (runs.length === 0) {
    res.status(404).json({ error: "Import run not found" });
    return;
  }

  res.json(serializeImportRun(runs[0]!));
});
