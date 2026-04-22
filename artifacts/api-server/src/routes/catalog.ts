import { Router } from "express";
import { db, businessesTable, categoriesTable } from "@workspace/db";
import { and, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { getBusinessSources } from "../services/businessSourceService";
import { getReviewQueue } from "../services/reviewQueueService";
import { requireAdminAuth } from "../lib/adminAuth";
import { serializeBusiness } from "./shared/businessRouteUtils";

const router = Router();

router.get("/categories", async (_req, res) => {
  const rows = await db.select().from(categoriesTable).orderBy(categoriesTable.label);
  res.json(
    rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      label: r.label,
      description: r.description ?? null,
      osmTags: r.osmTags,
      active: r.active,
      createdAt: r.createdAt.toISOString(),
    })),
  );
});

router.get("/businesses", async (req, res) => {
  const {
    search,
    categorySlug,
    city,
    targetMarket,
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
  if (targetMarket) conditions.push(eq(businessesTable.targetMarket, targetMarket));
  if (hasWebsite === "true") conditions.push(eq(businessesTable.hasWebsite, true));
  if (hasWebsite === "false") conditions.push(eq(businessesTable.hasWebsite, false));
  if (hasPhone === "true") conditions.push(eq(businessesTable.hasPhone, true));
  if (hasPhone === "false") conditions.push(eq(businessesTable.hasPhone, false));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, totalResult] = await Promise.all([
    db
      .select()
      .from(businessesTable)
      .where(where)
      .orderBy(businessesTable.name)
      .limit(size)
      .offset(offset),
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
  const { categorySlug, city, limit = "25" } = req.query as Record<string, string | undefined>;

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
  const id = parseInt(req.params["id"] ?? "0", 10);
  if (!id || isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const rows = await db.select().from(businessesTable).where(eq(businessesTable.id, id)).limit(1);
  if (rows.length === 0) {
    res.status(404).json({ error: "Business not found" });
    return;
  }

  res.json(serializeBusiness(rows[0]!));
});

router.get("/businesses/:id/sources", async (req, res) => {
  const id = parseInt(req.params["id"] ?? "0", 10);
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

router.get("/stats", async (req, res) => {
  const { categorySlug } = req.query as { categorySlug?: string };
  const where = categorySlug ? eq(businessesTable.categorySlug, categorySlug) : undefined;

  const [totals, byCategoryRaw, byCityRaw] = await Promise.all([
    db
      .select({
        total: count(),
        withWebsite: sql<number>`count(*) filter (where has_website = true)`,
        withPhone: sql<number>`count(*) filter (where has_phone = true)`,
        enriched: sql<number>`count(*) filter (where enrichment_status = 'enriched')`,
      })
      .from(businessesTable)
      .where(where),
    db
      .select({ categorySlug: businessesTable.categorySlug, count: count() })
      .from(businessesTable)
      .groupBy(businessesTable.categorySlug)
      .orderBy(desc(count())),
    db
      .select({ city: businessesTable.city, count: count() })
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
    byCategoryBreakdown: byCategoryRaw.map((r) => ({
      categorySlug: r.categorySlug,
      count: Number(r.count),
    })),
    byCityBreakdown: byCityRaw.map((r) => ({ city: r.city, count: Number(r.count) })),
  });
});

router.get("/export/businesses.csv", async (req, res) => {
  const { categorySlug, city, targetMarket } = req.query as Record<string, string | undefined>;
  const conditions = [];
  if (categorySlug) conditions.push(eq(businessesTable.categorySlug, categorySlug));
  if (city) conditions.push(ilike(businessesTable.city, `%${city}%`));
  if (targetMarket) conditions.push(eq(businessesTable.targetMarket, targetMarket));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db.select().from(businessesTable).where(where).orderBy(businessesTable.name);

  const headers = [
    "id",
    "category",
    "target_market",
    "name",
    "city",
    "address",
    "postal_code",
    "latitude",
    "longitude",
    "website",
    "phone",
    "osm_id",
    "rating",
    "enrichment_status",
    "created_at",
  ];

  const esc = (v: unknown): string => {
    if (v == null) return "";
    const s = String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };

  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      [
        r.id,
        esc(r.categorySlug),
        esc(r.targetMarket),
        esc(r.name),
        esc(r.city),
        esc(r.addressLine),
        esc(r.postalCode),
        esc(r.latitude),
        esc(r.longitude),
        esc(r.website),
        esc(r.phone),
        esc(r.osmId),
        esc(r.rating),
        esc(r.enrichmentStatus),
        r.createdAt.toISOString(),
      ].join(","),
    ),
  ];

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="businesses.csv"');
  res.send(lines.join("\n"));
});

export default router;
