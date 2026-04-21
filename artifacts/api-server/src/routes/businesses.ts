import { Router } from "express";
import { db, businessesTable, importRunsTable, categoriesTable } from "@workspace/db";
import { eq, ilike, and, sql, count, desc, or } from "drizzle-orm";
import { runImport } from "../services/importOrchestrator";

const router = Router();

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

router.get("/businesses/:id", async (req, res) => {
  const id = parseInt(req.params["id"] ?? "0", 10);
  if (!id || isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const rows = await db.select().from(businessesTable).where(eq(businessesTable.id, id)).limit(1);
  if (rows.length === 0) { res.status(404).json({ error: "Business not found" }); return; }
  res.json(serializeBusiness(rows[0]!));
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

router.post("/imports/run", async (req, res) => {
  const { categorySlug, city } = req.body as { categorySlug?: string; city?: string };
  if (!categorySlug || !city) {
    res.status(400).json({ error: "categorySlug and city are required" });
    return;
  }
  req.log.info({ categorySlug, city }, "Starting import");
  const result = await runImport(categorySlug, city);
  res.json({
    success: result.success,
    fetched: result.stats.fetched,
    inserted: result.stats.inserted,
    updated: result.stats.updated,
    skipped: result.stats.skipped,
    errors: result.stats.errors,
    message: result.message,
    runId: result.runId,
  });
});

router.get("/imports/runs", async (_req, res) => {
  const runs = await db
    .select()
    .from(importRunsTable)
    .orderBy(desc(importRunsTable.startedAt))
    .limit(50);

  res.json(runs.map((r) => ({
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
  })));
});

router.get("/export/businesses.csv", async (req, res) => {
  const { categorySlug, city } = req.query as Record<string, string | undefined>;
  const conditions = [];
  if (categorySlug) conditions.push(eq(businessesTable.categorySlug, categorySlug));
  if (city) conditions.push(ilike(businessesTable.city, `%${city}%`));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db.select().from(businessesTable).where(where).orderBy(businessesTable.name);

  const headers = ["id", "category", "name", "city", "address", "postal_code", "latitude", "longitude", "website", "phone", "osm_id", "rating", "enrichment_status", "created_at"];

  const esc = (v: unknown): string => {
    if (v == null) return "";
    const s = String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const lines = [
    headers.join(","),
    ...rows.map((r) => [r.id, esc(r.categorySlug), esc(r.name), esc(r.city), esc(r.addressLine), esc(r.postalCode), esc(r.latitude), esc(r.longitude), esc(r.website), esc(r.phone), esc(r.osmId), esc(r.rating), esc(r.enrichmentStatus), r.createdAt.toISOString()].join(",")),
  ];

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="businesses.csv"');
  res.send(lines.join("\n"));
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

export default router;
