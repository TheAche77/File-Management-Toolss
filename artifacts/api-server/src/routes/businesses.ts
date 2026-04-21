import { Router } from "express";
import { db, businessesTable, importRunsTable, categoriesTable, contactCandidatesTable } from "@workspace/db";
import type { ImportRun as DbImportRun } from "@workspace/db";
import { eq, ilike, and, sql, count, desc, or, ne } from "drizzle-orm";
import { queueImportRun } from "../services/importJobService";
import { getBusinessSources } from "../services/businessSourceService";
import { getContactCandidates } from "../services/contactCandidateService";
import { getReviewQueue } from "../services/reviewQueueService";
import { requireAdminAuth } from "../lib/adminAuth";

const router = Router();
const CONTACT_CANDIDATE_STATUSES = new Set(["suggested", "approved", "rejected"]);
const OUTREACH_STATUSES = new Set([
  "not_contacted",
  "emailed",
  "follow_up_1",
  "follow_up_2",
  "interested",
  "closed_won",
  "closed_lost",
]);
const ASSIGNED_ARTISTS = new Set(["Ache77", "Exit Enter", "Nian", "Kraita317"]);
const AVATAR_TYPES = new Set([
  "gallery_director",
  "hotel_art_curator",
  "festival",
  "museum_shop",
  "institution",
]);
const TARGET_MARKETS = new Set(["IT", "UK", "NL", "FR", "ES", "PT", "RO"]);

function normalizeNullableString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function normalizeNullableDateString(value: unknown): string | null | undefined {
  const normalized = normalizeNullableString(value);
  if (normalized === undefined || normalized === null) return normalized;

  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : undefined;
}

router.get("/categories", async (_req, res) => {
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

router.get("/businesses", async (req, res) => {
  const {
    search,
    categorySlug,
    city,
    hasWebsite,
    hasPhone,
    page = "1",
    pageSize = "50",
  } = req.query as Record<string, string | undefined>;

  const pageNum = Math.max(1, parseInt(page ?? "1", 10));
  const size = Math.min(100, Math.max(1, parseInt(pageSize ?? "50", 10)));
  const offset = (pageNum - 1) * size;

  const conditions = [];

  if (search) {
    conditions.push(
      or(
        ilike(businessesTable.name, `%${search}%`),
        ilike(businessesTable.addressLine, `%${search}%`),
        ilike(businessesTable.city, `%${search}%`),
      ),
    );
  }
  if (categorySlug) conditions.push(eq(businessesTable.categorySlug, categorySlug));
  if (city) conditions.push(ilike(businessesTable.city, `%${city}%`));
  if (hasWebsite === "true") conditions.push(eq(businessesTable.hasWebsite, true));
  if (hasWebsite === "false") conditions.push(eq(businessesTable.hasWebsite, false));
  if (hasPhone === "true") conditions.push(eq(businessesTable.hasPhone, true));
  if (hasPhone === "false") conditions.push(eq(businessesTable.hasPhone, false));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, totalResult] = await Promise.all([
    db.select().from(businessesTable).where(where).orderBy(businessesTable.name).limit(size).offset(offset),
    db.select({ count: count() }).from(businessesTable).where(where),
  ]);

  const total = Number(totalResult[0]?.count ?? 0);
  res.json({
    businesses: rows.map(serializeBusiness),
    total,
    page: pageNum,
    pageSize: size,
    totalPages: Math.ceil(total / size),
  });
});

router.get("/businesses/review-queue", requireAdminAuth, async (req, res) => {
  const {
    categorySlug,
    city,
    limit = "25",
  } = req.query as Record<string, string | undefined>;

  const items = await getReviewQueue({
    categorySlug,
    city,
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

router.get("/businesses/:id", async (req, res) => {
  const id = parseInt(String(req.params["id"] ?? "0"), 10);
  if (!id || isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const rows = await db.select().from(businessesTable).where(eq(businessesTable.id, id)).limit(1);
  if (rows.length === 0) { res.status(404).json({ error: "Business not found" }); return; }
  res.json(serializeBusiness(rows[0]!));
});

router.get("/businesses/:id/outreach", requireAdminAuth, async (req, res) => {
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

router.patch("/businesses/:id/outreach", requireAdminAuth, async (req, res) => {
  const id = parseInt(String(req.params["id"] ?? "0"), 10);
  if (!id || isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
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

  res.json(serializeBusinessOutreach(updated));
});

router.get("/businesses/:id/sources", async (req, res) => {
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
      httpStatus: source.httpStatus ?? null,
      isOfficial: source.isOfficial,
      createdAt: source.createdAt.toISOString(),
      updatedAt: source.updatedAt.toISOString(),
    })),
  );
});

router.get("/businesses/:id/contact-candidates", requireAdminAuth, async (req, res) => {
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

router.patch("/businesses/:id/contact-candidates/:candidateId", requireAdminAuth, async (req, res) => {
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

  res.json(serializeContactCandidate(updated));
});

router.get("/stats", async (req, res) => {
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

router.get("/outreach/dashboard", requireAdminAuth, async (_req, res) => {
  const today = getTodayDateString();
  const rows = await getOutreachRows();
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

router.get("/outreach/pipeline", requireAdminAuth, async (req, res) => {
  const {
    horizonDays = "7",
    limit = "50",
  } = req.query as Record<string, string | undefined>;

  const parsedHorizonDays = Math.max(1, Math.min(30, parseInt(horizonDays ?? "7", 10) || 7));
  const parsedLimit = Math.max(1, Math.min(200, parseInt(limit ?? "50", 10) || 50));
  const today = getTodayDateString();
  const rows = await getOutreachRows();
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

router.post("/imports/run", requireAdminAuth, async (req, res) => {
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

router.get("/imports/runs", requireAdminAuth, async (_req, res) => {
  const runs = await db
    .select()
    .from(importRunsTable)
    .orderBy(desc(importRunsTable.startedAt))
    .limit(50);

  res.json(runs.map(serializeImportRun));
});

router.get("/imports/runs/:id", requireAdminAuth, async (req, res) => {
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

router.get("/export/businesses.csv", async (req, res) => {
  const { categorySlug, city } = req.query as Record<string, string | undefined>;
  const conditions = [];
  if (categorySlug) conditions.push(eq(businessesTable.categorySlug, categorySlug));
  if (city) conditions.push(ilike(businessesTable.city, `%${city}%`));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db.select().from(businessesTable).where(where).orderBy(businessesTable.categorySlug, businessesTable.name);

  const CATEGORY_LABELS: Record<string, string> = {
    art_gallery: "Galleria d'Arte",
    bookstore: "Libreria",
    museum: "Museo",
  };

  const headers = [
    "id", "categoria", "nome", "indirizzo", "citta", "cap", "regione", "paese",
    "latitudine", "longitudine", "sito_web", "telefono", "osm_id", "osm_tipo",
    "valutazione", "numero_recensioni", "ha_sito_web", "ha_telefono",
    "stato_arricchimento", "stato_outreach", "nome_contatto", "ruolo_contatto",
    "email_contatto", "data_ultimo_contatto", "data_prossima_azione",
    "artista_assegnato", "tipo_avatar", "mercato_target", "note",
    "connessione_calda", "creato_il", "aggiornato_il",
  ];

  const esc = (v: unknown): string => {
    if (v == null) return "";
    const s = String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };

  const lines = [
    headers.join(","),
    ...rows.map((r) => [
      r.id,
      esc(CATEGORY_LABELS[r.categorySlug] ?? r.categorySlug),
      esc(r.name),
      esc(r.addressLine),
      esc(r.city),
      esc(r.postalCode),
      esc(r.region),
      esc(r.country),
      esc(r.latitude),
      esc(r.longitude),
      esc(r.website),
      esc(r.phone),
      esc(r.osmId),
      esc(r.osmType),
      esc(r.rating),
      esc(r.userRatingsTotal),
      r.hasWebsite ? "Sì" : "No",
      r.hasPhone ? "Sì" : "No",
      esc(r.enrichmentStatus),
      esc(r.outreachStatus),
      esc(r.contactName),
      esc(r.contactRole),
      esc(r.contactEmail),
      esc(r.lastContactDate),
      esc(r.nextActionDate),
      esc(r.assignedArtist),
      esc(r.avatarType),
      esc(r.targetMarket),
      esc(r.notes),
      esc(r.warmConnection),
      r.createdAt.toISOString().replace("T", " ").slice(0, 16),
      r.updatedAt.toISOString().replace("T", " ").slice(0, 16),
    ].join(",")),
  ];

  const filename = categorySlug
    ? `scopri_italia_${categorySlug}.csv`
    : "scopri_italia_business.csv";

  // UTF-8 BOM so Excel opens it correctly without encoding issues
  const BOM = "\uFEFF";
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(BOM + lines.join("\r\n"));
});

// Legacy redirect - galleries was the old path
router.get("/galleries", async (req, res) => {
  const newUrl = `/api/businesses?categorySlug=art_gallery&${new URLSearchParams(req.query as Record<string, string>).toString()}`;
  res.redirect(301, newUrl);
});

function serializeBusiness(r: Record<string, unknown>) {
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
    createdAt: (r["createdAt"] as Date).toISOString(),
    updatedAt: (r["updatedAt"] as Date).toISOString(),
  };
}

function serializeBusinessOutreach(r: Record<string, unknown>) {
  return {
    businessId: r["id"],
    outreachStatus: r["outreachStatus"],
    contactName: r["contactName"] ?? null,
    contactRole: r["contactRole"] ?? null,
    contactEmail: r["contactEmail"] ?? null,
    lastContactDate: r["lastContactDate"] ?? null,
    nextActionDate: r["nextActionDate"] ?? null,
    assignedArtist: r["assignedArtist"] ?? null,
    avatarType: r["avatarType"] ?? null,
    targetMarket: r["targetMarket"] ?? null,
    notes: r["notes"] ?? null,
    warmConnection: r["warmConnection"] ?? null,
    updatedAt: (r["updatedAt"] as Date).toISOString(),
  };
}

function getTodayDateString() {
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

function compareDateStrings(left: string, right: string) {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function diffDateStringsInDays(left: string, right: string) {
  const leftDate = new Date(`${left}T00:00:00Z`);
  const rightDate = new Date(`${right}T00:00:00Z`);
  return Math.round((leftDate.getTime() - rightDate.getTime()) / 86_400_000);
}

function isClosedOutreachStatus(status: string) {
  return status === "closed_won" || status === "closed_lost";
}

async function getOutreachRows() {
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
      avatarType: businessesTable.avatarType,
      targetMarket: businessesTable.targetMarket,
      contactName: businessesTable.contactName,
      contactRole: businessesTable.contactRole,
      contactEmail: businessesTable.contactEmail,
      warmConnection: businessesTable.warmConnection,
      notes: businessesTable.notes,
      updatedAt: businessesTable.updatedAt,
    })
    .from(businessesTable);
}

function getRecommendedAction(status: string) {
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

function getUrgencyBucket(status: string, nextActionDate: string | null | undefined, today: string) {
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

function getUrgencySortValue(bucket: string) {
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

function buildOutreachPipelineItems(
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
        avatarType: row.avatarType ?? null,
        targetMarket: row.targetMarket ?? null,
        contactName: row.contactName ?? null,
        contactRole: row.contactRole ?? null,
        contactEmail: row.contactEmail ?? null,
        warmConnection: row.warmConnection ?? null,
        notes: row.notes ?? null,
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

function serializeImportRun(r: DbImportRun) {
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

function serializeContactCandidate(candidate: Record<string, unknown>) {
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
    reviewStatus: candidate["reviewStatus"],
    notes: candidate["notes"] ?? null,
    createdAt: (candidate["createdAt"] as Date).toISOString(),
    updatedAt: (candidate["updatedAt"] as Date).toISOString(),
  };
}

export default router;
