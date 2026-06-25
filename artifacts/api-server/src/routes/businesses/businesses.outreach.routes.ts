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
import { ASSIGNED_ARTISTS, ASSIGNED_ARTIST_SOURCES, AVATAR_TYPES, CONTACT_CANDIDATE_STATUSES, OUTREACH_STATUSES, RESEARCH_JOB_TYPES_SET, TARGET_MARKETS, buildBusinessFilters, buildCsv, buildOutreachPipelineItems, compareDateStrings, filterOutreachRows, getOutreachRows, getTodayDateString, isClosedOutreachStatus, normalizeNullableDateString, normalizeNullableString, parseOptionalNumber, serializeBusiness, serializeBusinessOutreach, serializeContactCandidate, serializeImportRun } from "./businesses.shared";

export const businessesOutreachRouter = Router();

businessesOutreachRouter.get("/businesses/:id/outreach", async (req, res) => {
  const id = parseInt(String(req.params["id"] ?? "0"), 10);
  if (!id || isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const rows = await db
    .select()
    .from(businessesTable)
    .where(eq(businessesTable.id, id))
    .limit(1);

  if (rows.length === 0) {
    res.status(404).json({ error: "Business not found" });
    return;
  }

  res.json(serializeBusinessOutreach(rows[0]!));
});

businessesOutreachRouter.patch("/businesses/:id/outreach", async (req, res) => {
  const id = parseInt(String(req.params["id"] ?? "0"), 10);
  if (!id || isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const existingRows = await db
    .select()
    .from(businessesTable)
    .where(eq(businessesTable.id, id))
    .limit(1);

  if (existingRows.length === 0) {
    res.status(404).json({ error: "Business not found" });
    return;
  }

  const body = req.body as Record<string, unknown>;
  const outreachStatus = normalizeNullableString(body["outreachStatus"]);
  const contactName = normalizeNullableString(body["contactName"]);
  const contactRole = normalizeNullableString(body["contactRole"]);
  const contactEmail = normalizeNullableString(body["contactEmail"]);
  const lastContactDate = normalizeNullableDateString(body["lastContactDate"]);
  const nextActionDate = normalizeNullableDateString(body["nextActionDate"]);
  const assignedArtist = normalizeNullableString(body["assignedArtist"]);
  const assignedArtistSource = normalizeNullableString(body["assignedArtistSource"]);
  const avatarType = normalizeNullableString(body["avatarType"]);
  const targetMarket = normalizeNullableString(body["targetMarket"]);
  const notes = normalizeNullableString(body["notes"]);
  const warmConnection = normalizeNullableString(body["warmConnection"]);

  if (body["outreachStatus"] !== undefined && (!outreachStatus || !OUTREACH_STATUSES.has(outreachStatus))) {
    res.status(400).json({ error: "Invalid outreachStatus" });
    return;
  }

  if (body["assignedArtist"] !== undefined && assignedArtist !== null && (!assignedArtist || !ASSIGNED_ARTISTS.has(assignedArtist))) {
    res.status(400).json({ error: "Invalid assignedArtist" });
    return;
  }

  if (body["assignedArtistSource"] !== undefined && assignedArtistSource !== null && (!assignedArtistSource || !ASSIGNED_ARTIST_SOURCES.has(assignedArtistSource))) {
    res.status(400).json({ error: "Invalid assignedArtistSource" });
    return;
  }

  if (body["avatarType"] !== undefined && avatarType !== null && (!avatarType || !AVATAR_TYPES.has(avatarType))) {
    res.status(400).json({ error: "Invalid avatarType" });
    return;
  }

  if (body["targetMarket"] !== undefined && targetMarket !== null && (!targetMarket || !TARGET_MARKETS.has(targetMarket))) {
    res.status(400).json({ error: "Invalid targetMarket" });
    return;
  }

  if (body["lastContactDate"] !== undefined && lastContactDate === undefined) {
    res.status(400).json({ error: "Invalid lastContactDate" });
    return;
  }

  if (body["nextActionDate"] !== undefined && nextActionDate === undefined) {
    res.status(400).json({ error: "Invalid nextActionDate" });
    return;
  }

  const updateValues = Object.fromEntries(
    Object.entries({
      outreachStatus,
      contactName,
      contactRole,
      contactEmail,
      lastContactDate,
      nextActionDate,
      assignedArtist,
      assignedArtistSource:
        body["assignedArtistSource"] !== undefined || body["assignedArtist"] !== undefined
          ? assignedArtist
            ? assignedArtistSource ?? undefined
            : null
          : undefined,
      avatarType,
      targetMarket,
      notes,
      warmConnection,
    }).filter(([, value]) => value !== undefined),
  );

  if (Object.keys(updateValues).length === 0) {
    res.status(400).json({ error: "At least one outreach field must be updated" });
    return;
  }

  const [updated] = await db
    .update(businessesTable)
    .set({
      ...updateValues,
      updatedAt: new Date(),
    })
    .where(eq(businessesTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Business not found" });
    return;
  }

  await recordOutreachUpdate(existingRows[0]!, updated);
  const refreshed = await refreshBusinessResearchState(id);
  res.json(serializeBusinessOutreach(refreshed?.business ?? updated));
});

businessesOutreachRouter.get("/businesses/:id/outreach-events", async (req, res) => {
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

  const events = await getOutreachEvents(id);
  res.json(
    events.map((event) => ({
      id: event.id,
      businessId: event.businessId,
      eventType: event.eventType,
      entityType: event.entityType,
      entityId: event.entityId ?? null,
      actorType: event.actorType,
      summary: event.summary,
      changedFields: event.changedFields,
      payload: event.payload,
      createdAt: event.createdAt.toISOString(),
    })),
  );
});

businessesOutreachRouter.get("/businesses/:id/contact-candidates", async (req, res) => {
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

  const contactCandidates = await getContactCandidates(id);
  res.json(
    contactCandidates.map(serializeContactCandidate),
  );
});

businessesOutreachRouter.patch("/businesses/:id/contact-candidates/:candidateId", async (req, res) => {
  const businessId = parseInt(String(req.params["id"] ?? "0"), 10);
  const candidateId = parseInt(String(req.params["candidateId"] ?? "0"), 10);

  if (!businessId || isNaN(businessId) || !candidateId || isNaN(candidateId)) {
    res.status(400).json({ error: "Invalid contact candidate identifier" });
    return;
  }

  const body = req.body as {
    reviewStatus?: string;
    isPrimary?: boolean;
  };

  if (body.reviewStatus && !CONTACT_CANDIDATE_STATUSES.has(body.reviewStatus)) {
    res.status(400).json({ error: "Invalid reviewStatus" });
    return;
  }

  if (body.reviewStatus === undefined && body.isPrimary === undefined) {
    res.status(400).json({ error: "At least one field must be updated" });
    return;
  }

  const candidates = await db
    .select()
    .from(contactCandidatesTable)
    .where(
      and(
        eq(contactCandidatesTable.id, candidateId),
        eq(contactCandidatesTable.businessId, businessId),
      ),
    )
    .limit(1);

  if (candidates.length === 0) {
    res.status(404).json({ error: "Contact candidate not found" });
    return;
  }

  const existing = candidates[0]!;
  const nextReviewStatus = body.reviewStatus ?? existing.reviewStatus;
  const nextIsPrimary =
    nextReviewStatus === "rejected"
      ? false
      : body.isPrimary ?? existing.isPrimary;

  const [updated] = await db.transaction(async (tx) => {
    if (nextIsPrimary) {
      await tx
        .update(contactCandidatesTable)
        .set({
          isPrimary: false,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(contactCandidatesTable.businessId, businessId),
            ne(contactCandidatesTable.id, candidateId),
            eq(contactCandidatesTable.isPrimary, true),
          ),
        );
    }

    const [result] = await tx
      .update(contactCandidatesTable)
      .set({
        reviewStatus: nextIsPrimary ? "approved" : nextReviewStatus,
        isPrimary: nextIsPrimary,
        updatedAt: new Date(),
      })
      .where(eq(contactCandidatesTable.id, candidateId))
      .returning();

    return [result];
  });

  if (!updated) {
    res.status(500).json({ error: "Failed to update contact candidate" });
    return;
  }

  await recordContactCandidateUpdate(businessId, existing, updated);
  await refreshBusinessResearchState(businessId);
  res.json(serializeContactCandidate(updated));
});

businessesOutreachRouter.get("/outreach/dashboard", async (req, res) => {
  const today = getTodayDateString();
  const { categorySlug, city, targetMarket } = req.query as Record<string, string | undefined>;
  const rows = filterOutreachRows(await getOutreachRows(), {
    categorySlug,
    city,
    targetMarket,
  });
  const activeRows = rows.filter((row) => !isClosedOutreachStatus(row.outreachStatus as string));
  const contacted = rows.filter((row) => (row.outreachStatus as string) !== "not_contacted").length;
  const positiveResponses = rows.filter((row) =>
    new Set(["interested", "closed_won"]).has((row.outreachStatus as string) ?? ""),
  ).length;
  const inProgress = rows.filter((row) =>
    new Set(["emailed", "follow_up_1", "follow_up_2"]).has((row.outreachStatus as string) ?? ""),
  ).length;
  const interested = rows.filter((row) => row.outreachStatus === "interested").length;
  const overdueFollowUps = activeRows.filter((row) => {
    if ((row.outreachStatus as string) === "not_contacted") return false;
    const nextActionDate = row.nextActionDate as string | null | undefined;
    return Boolean(nextActionDate && compareDateStrings(nextActionDate, today) < 0);
  }).length;

  const urgentThisWeek = buildOutreachPipelineItems(rows, {
    today,
    horizonDays: 7,
    limit: 6,
  });

  res.json({
    totalTargets: rows.length,
    contacted,
    positiveResponses,
    responseRate: contacted > 0 ? positiveResponses / contacted : 0,
    overdueFollowUps,
    inProgress,
    interested,
    urgentThisWeek,
  });
});

businessesOutreachRouter.get("/outreach/pipeline", async (req, res) => {
  const {
    horizonDays = "7",
    limit = "50",
    categorySlug,
    city,
    targetMarket,
  } = req.query as Record<string, string | undefined>;

  const parsedHorizonDays = Math.max(1, Math.min(30, parseInt(horizonDays ?? "7", 10) || 7));
  const parsedLimit = Math.max(1, Math.min(200, parseInt(limit ?? "50", 10) || 50));
  const today = getTodayDateString();
  const rows = filterOutreachRows(await getOutreachRows(), {
    categorySlug,
    city,
    targetMarket,
  });
  const items = buildOutreachPipelineItems(rows, {
    today,
    horizonDays: parsedHorizonDays,
    limit: parsedLimit,
  });

  res.json({
    today,
    horizonDays: parsedHorizonDays,
    total: items.length,
    summary: {
      urgent: items.filter((item) => item.urgencyBucket === "urgent").length,
      thisWeek: items.filter((item) => item.urgencyBucket === "this_week").length,
      next: items.filter((item) => item.urgencyBucket === "next").length,
    },
    items,
  });
});
