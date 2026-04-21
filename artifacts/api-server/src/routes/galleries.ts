import { Router } from "express";
import { db, galleriesTable, importRunsTable } from "@workspace/db";
import { eq, ilike, and, sql, count, desc, or } from "drizzle-orm";
import {
  GetGalleriesQueryParams,
  GetGalleryByIdParams,
} from "@workspace/api-zod";
import { importRomeFromOsm } from "../services/importService";

const router = Router();

router.get("/galleries", async (req, res) => {
  const parsed = GetGalleriesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query parameters" });
    return;
  }

  const {
    search,
    city,
    hasWebsite,
    hasPhone,
    source,
    page = 1,
    pageSize = 50,
  } = parsed.data;

  const conditions = [];

  if (search) {
    conditions.push(
      or(
        ilike(galleriesTable.name, `%${search}%`),
        ilike(galleriesTable.addressLine, `%${search}%`),
        ilike(galleriesTable.city, `%${search}%`),
      ),
    );
  }
  if (city) {
    conditions.push(ilike(galleriesTable.city, `%${city}%`));
  }
  if (hasWebsite !== undefined) {
    conditions.push(eq(galleriesTable.hasWebsite, hasWebsite));
  }
  if (hasPhone !== undefined) {
    conditions.push(eq(galleriesTable.hasPhone, hasPhone));
  }
  if (source) {
    conditions.push(eq(galleriesTable.sourcePrimary, source));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const offset = (page - 1) * pageSize;

  const [rows, totalResult] = await Promise.all([
    db
      .select()
      .from(galleriesTable)
      .where(where)
      .orderBy(galleriesTable.name)
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: count() })
      .from(galleriesTable)
      .where(where),
  ]);

  const total = Number(totalResult[0]?.count ?? 0);

  res.json({
    galleries: rows.map(serializeGallery),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
});

router.get("/galleries/:id", async (req, res) => {
  const parsed = GetGalleryByIdParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const rows = await db
    .select()
    .from(galleriesTable)
    .where(eq(galleriesTable.id, parsed.data.id))
    .limit(1);

  if (rows.length === 0) {
    res.status(404).json({ error: "Gallery not found" });
    return;
  }

  res.json(serializeGallery(rows[0]!));
});

router.get("/stats", async (_req, res) => {
  const [totals, byCityRaw] = await Promise.all([
    db
      .select({
        total: count(),
        withWebsite: sql<number>`count(*) filter (where has_website = true)`,
        withPhone: sql<number>`count(*) filter (where has_phone = true)`,
        fromOsm: sql<number>`count(*) filter (where source_primary = 'osm')`,
        enriched: sql<number>`count(*) filter (where enrichment_status = 'enriched')`,
      })
      .from(galleriesTable),
    db
      .select({
        city: galleriesTable.city,
        count: count(),
      })
      .from(galleriesTable)
      .groupBy(galleriesTable.city)
      .orderBy(desc(count())),
  ]);

  const t = totals[0] ?? {
    total: 0,
    withWebsite: 0,
    withPhone: 0,
    fromOsm: 0,
    enriched: 0,
  };

  res.json({
    totalGalleries: Number(t.total),
    galleriesWithWebsite: Number(t.withWebsite),
    galleriesWithPhone: Number(t.withPhone),
    fromOsm: Number(t.fromOsm),
    enriched: Number(t.enriched),
    byCityBreakdown: byCityRaw.map((r) => ({
      city: r.city,
      count: Number(r.count),
    })),
  });
});

router.post("/imports/osm/rome", async (req, res) => {
  req.log.info("Starting OSM Rome import");
  const result = await importRomeFromOsm();
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

router.get("/import-runs", async (_req, res) => {
  const runs = await db
    .select()
    .from(importRunsTable)
    .orderBy(desc(importRunsTable.startedAt))
    .limit(20);

  res.json(
    runs.map((r) => ({
      id: r.id,
      source: r.source,
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
    })),
  );
});

router.get("/export/galleries.csv", async (_req, res) => {
  const rows = await db.select().from(galleriesTable).orderBy(galleriesTable.name);

  const headers = [
    "id",
    "name",
    "city",
    "address_line",
    "postal_code",
    "latitude",
    "longitude",
    "website",
    "phone",
    "source",
    "enrichment_status",
    "osm_id",
    "osm_type",
    "google_place_id",
    "rating",
    "created_at",
  ];

  const escape = (v: string | null | undefined): string => {
    if (v == null) return "";
    const str = String(v);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      [
        r.id,
        escape(r.name),
        escape(r.city),
        escape(r.addressLine),
        escape(r.postalCode),
        escape(r.latitude),
        escape(r.longitude),
        escape(r.website),
        escape(r.phone),
        escape(r.sourcePrimary),
        escape(r.enrichmentStatus),
        escape(r.osmId),
        escape(r.osmType),
        escape(r.googlePlaceId),
        escape(r.rating),
        r.createdAt.toISOString(),
      ].join(","),
    ),
  ];

  res.setHeader("Content-Type", "text/csv");
  res.setHeader(
    "Content-Disposition",
    "attachment; filename=galleries.csv",
  );
  res.send(lines.join("\n"));
});

function serializeGallery(r: Record<string, unknown>) {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    latitude: r.latitude,
    longitude: r.longitude,
    addressLine: r.addressLine ?? null,
    city: r.city ?? null,
    postalCode: r.postalCode ?? null,
    region: r.region ?? null,
    country: r.country ?? null,
    website: r.website ?? null,
    phone: r.phone ?? null,
    sourcePrimary: r.sourcePrimary,
    osmId: r.osmId ?? null,
    osmType: r.osmType ?? null,
    googlePlaceId: r.googlePlaceId ?? null,
    googleMapsUrl: r.googleMapsUrl ?? null,
    rating: r.rating ?? null,
    userRatingsTotal: r.userRatingsTotal ?? null,
    hasWebsite: r.hasWebsite,
    hasPhone: r.hasPhone,
    enrichmentStatus: r.enrichmentStatus,
    createdAt: (r.createdAt as Date).toISOString(),
    updatedAt: (r.updatedAt as Date).toISOString(),
    lastCheckedAt: r.lastCheckedAt
      ? (r.lastCheckedAt as Date).toISOString()
      : null,
  };
}

export default router;
