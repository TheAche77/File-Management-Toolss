import { Router } from "express";
import {
  businessesTable,
  caseStudiesTable,
  contentAssetsTable,
  credibilityAssetsTable,
  db,
  narrativesTable,
  offersTable,
  relationshipPathsTable,
  seasonalWindowsTable,
  strategicAccountsTable,
} from "@workspace/db";
import { asc, eq } from "drizzle-orm";
import { ensureSlgReferenceData } from "../services/slgReferenceDataService";

const router = Router();

function normalizeNullableString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function normalizeRequiredStringForPatch(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function normalizeOptionalInt(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeRequiredIntForPatch(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeOptionalBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  return undefined;
}

function parseId(value: string | undefined) {
  const id = Number.parseInt(String(value ?? "0"), 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

router.get("/offers", async (_req, res) => {
  await ensureSlgReferenceData();
  const rows = await db.select().from(offersTable).orderBy(asc(offersTable.name));
  res.json(rows);
});

router.post("/offers", async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const slug = normalizeNullableString(body["slug"]);
  const name = normalizeNullableString(body["name"]);
  const engineType = normalizeNullableString(body["engineType"]);
  const offerType = normalizeNullableString(body["offerType"]);
  if (!slug || !name || !engineType || !offerType) {
    res.status(400).json({ error: "slug, name, engineType, and offerType are required" });
    return;
  }

  const [created] = await db
    .insert(offersTable)
    .values({
      slug,
      name,
      engineType,
      offerType,
      summary: normalizeNullableString(body["summary"]) ?? null,
      targetClusters: normalizeNullableString(body["targetClusters"]) ?? null,
      ticketMin: normalizeOptionalInt(body["ticketMin"]) ?? null,
      ticketMax: normalizeOptionalInt(body["ticketMax"]) ?? null,
      recurringPotential: normalizeOptionalInt(body["recurringPotential"]) ?? null,
      bundleable: normalizeOptionalBoolean(body["bundleable"]) ?? false,
      active: normalizeOptionalBoolean(body["active"]) ?? true,
      updatedAt: new Date(),
    })
    .returning();

  res.status(201).json(created);
});

router.patch("/offers/:id", async (req, res) => {
  const id = parseId(req.params["id"]);
  if (!id) {
    res.status(400).json({ error: "Invalid offer identifier" });
    return;
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const [updated] = await db
    .update(offersTable)
    .set({
      slug: normalizeRequiredStringForPatch(body["slug"]),
      name: normalizeRequiredStringForPatch(body["name"]),
      engineType: normalizeRequiredStringForPatch(body["engineType"]),
      offerType: normalizeRequiredStringForPatch(body["offerType"]),
      summary: normalizeNullableString(body["summary"]),
      targetClusters: normalizeNullableString(body["targetClusters"]),
      ticketMin: normalizeOptionalInt(body["ticketMin"]),
      ticketMax: normalizeOptionalInt(body["ticketMax"]),
      recurringPotential: normalizeOptionalInt(body["recurringPotential"]),
      bundleable: normalizeOptionalBoolean(body["bundleable"]),
      active: normalizeOptionalBoolean(body["active"]),
      updatedAt: new Date(),
    })
    .where(eq(offersTable.id, id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Offer not found" });
    return;
  }
  res.json(updated);
});

router.delete("/offers/:id", async (req, res) => {
  const id = parseId(req.params["id"]);
  if (!id) {
    res.status(400).json({ error: "Invalid offer identifier" });
    return;
  }
  await db.delete(offersTable).where(eq(offersTable.id, id));
  res.status(204).end();
});

router.get("/narratives", async (_req, res) => {
  await ensureSlgReferenceData();
  const rows = await db.select().from(narrativesTable).orderBy(asc(narrativesTable.name));
  res.json(rows);
});

router.post("/narratives", async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const slug = normalizeNullableString(body["slug"]);
  const name = normalizeNullableString(body["name"]);
  if (!slug || !name) {
    res.status(400).json({ error: "slug and name are required" });
    return;
  }
  const [created] = await db
    .insert(narrativesTable)
    .values({
      slug,
      name,
      summary: normalizeNullableString(body["summary"]) ?? null,
      toneOfApproach: normalizeNullableString(body["toneOfApproach"]) ?? null,
      engineTypes: normalizeNullableString(body["engineTypes"]) ?? null,
      targetClusters: normalizeNullableString(body["targetClusters"]) ?? null,
      active: normalizeOptionalBoolean(body["active"]) ?? true,
      updatedAt: new Date(),
    })
    .returning();
  res.status(201).json(created);
});

router.patch("/narratives/:id", async (req, res) => {
  const id = parseId(req.params["id"]);
  if (!id) {
    res.status(400).json({ error: "Invalid narrative identifier" });
    return;
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const [updated] = await db
    .update(narrativesTable)
    .set({
      slug: normalizeRequiredStringForPatch(body["slug"]),
      name: normalizeRequiredStringForPatch(body["name"]),
      summary: normalizeNullableString(body["summary"]),
      toneOfApproach: normalizeNullableString(body["toneOfApproach"]),
      engineTypes: normalizeNullableString(body["engineTypes"]),
      targetClusters: normalizeNullableString(body["targetClusters"]),
      active: normalizeOptionalBoolean(body["active"]),
      updatedAt: new Date(),
    })
    .where(eq(narrativesTable.id, id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Narrative not found" });
    return;
  }
  res.json(updated);
});

router.delete("/narratives/:id", async (req, res) => {
  const id = parseId(req.params["id"]);
  if (!id) {
    res.status(400).json({ error: "Invalid narrative identifier" });
    return;
  }
  await db.delete(narrativesTable).where(eq(narrativesTable.id, id));
  res.status(204).end();
});

router.get("/credibility-assets", async (_req, res) => {
  await ensureSlgReferenceData();
  const rows = await db.select().from(credibilityAssetsTable).orderBy(asc(credibilityAssetsTable.name));
  res.json(rows);
});

router.post("/credibility-assets", async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const slug = normalizeNullableString(body["slug"]);
  const name = normalizeNullableString(body["name"]);
  const assetType = normalizeNullableString(body["assetType"]);
  if (!slug || !name || !assetType) {
    res.status(400).json({ error: "slug, name, and assetType are required" });
    return;
  }
  const [created] = await db
    .insert(credibilityAssetsTable)
    .values({
      slug,
      name,
      assetType,
      summary: normalizeNullableString(body["summary"]) ?? null,
      sourceUrl: normalizeNullableString(body["sourceUrl"]) ?? null,
      targetClusters: normalizeNullableString(body["targetClusters"]) ?? null,
      engineTypes: normalizeNullableString(body["engineTypes"]) ?? null,
      tags: normalizeNullableString(body["tags"]) ?? null,
      active: normalizeOptionalBoolean(body["active"]) ?? true,
      updatedAt: new Date(),
    })
    .returning();
  res.status(201).json(created);
});

router.patch("/credibility-assets/:id", async (req, res) => {
  const id = parseId(req.params["id"]);
  if (!id) {
    res.status(400).json({ error: "Invalid credibility asset identifier" });
    return;
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const [updated] = await db
    .update(credibilityAssetsTable)
    .set({
      slug: normalizeRequiredStringForPatch(body["slug"]),
      name: normalizeRequiredStringForPatch(body["name"]),
      assetType: normalizeRequiredStringForPatch(body["assetType"]),
      summary: normalizeNullableString(body["summary"]),
      sourceUrl: normalizeNullableString(body["sourceUrl"]),
      targetClusters: normalizeNullableString(body["targetClusters"]),
      engineTypes: normalizeNullableString(body["engineTypes"]),
      tags: normalizeNullableString(body["tags"]),
      active: normalizeOptionalBoolean(body["active"]),
      updatedAt: new Date(),
    })
    .where(eq(credibilityAssetsTable.id, id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Credibility asset not found" });
    return;
  }
  res.json(updated);
});

router.delete("/credibility-assets/:id", async (req, res) => {
  const id = parseId(req.params["id"]);
  if (!id) {
    res.status(400).json({ error: "Invalid credibility asset identifier" });
    return;
  }
  await db.delete(credibilityAssetsTable).where(eq(credibilityAssetsTable.id, id));
  res.status(204).end();
});

router.get("/case-studies", async (_req, res) => {
  await ensureSlgReferenceData();
  const rows = await db.select().from(caseStudiesTable).orderBy(asc(caseStudiesTable.title));
  res.json(rows);
});

router.post("/case-studies", async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const slug = normalizeNullableString(body["slug"]);
  const title = normalizeNullableString(body["title"]);
  if (!slug || !title) {
    res.status(400).json({ error: "slug and title are required" });
    return;
  }
  const [created] = await db
    .insert(caseStudiesTable)
    .values({
      slug,
      title,
      summary: normalizeNullableString(body["summary"]) ?? null,
      targetCluster: normalizeNullableString(body["targetCluster"]) ?? null,
      engineType: normalizeNullableString(body["engineType"]) ?? null,
      artist: normalizeNullableString(body["artist"]) ?? null,
      outcome: normalizeNullableString(body["outcome"]) ?? null,
      sourceUrl: normalizeNullableString(body["sourceUrl"]) ?? null,
      tags: normalizeNullableString(body["tags"]) ?? null,
      active: normalizeOptionalBoolean(body["active"]) ?? true,
      updatedAt: new Date(),
    })
    .returning();
  res.status(201).json(created);
});

router.patch("/case-studies/:id", async (req, res) => {
  const id = parseId(req.params["id"]);
  if (!id) {
    res.status(400).json({ error: "Invalid case study identifier" });
    return;
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const [updated] = await db
    .update(caseStudiesTable)
    .set({
      slug: normalizeRequiredStringForPatch(body["slug"]),
      title: normalizeRequiredStringForPatch(body["title"]),
      summary: normalizeNullableString(body["summary"]),
      targetCluster: normalizeNullableString(body["targetCluster"]),
      engineType: normalizeNullableString(body["engineType"]),
      artist: normalizeNullableString(body["artist"]),
      outcome: normalizeNullableString(body["outcome"]),
      sourceUrl: normalizeNullableString(body["sourceUrl"]),
      tags: normalizeNullableString(body["tags"]),
      active: normalizeOptionalBoolean(body["active"]),
      updatedAt: new Date(),
    })
    .where(eq(caseStudiesTable.id, id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Case study not found" });
    return;
  }
  res.json(updated);
});

router.delete("/case-studies/:id", async (req, res) => {
  const id = parseId(req.params["id"]);
  if (!id) {
    res.status(400).json({ error: "Invalid case study identifier" });
    return;
  }
  await db.delete(caseStudiesTable).where(eq(caseStudiesTable.id, id));
  res.status(204).end();
});

router.get("/seasonal-windows", async (_req, res) => {
  await ensureSlgReferenceData();
  const rows = await db.select().from(seasonalWindowsTable).orderBy(asc(seasonalWindowsTable.name));
  res.json(rows);
});

router.post("/seasonal-windows", async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const slug = normalizeNullableString(body["slug"]);
  const name = normalizeNullableString(body["name"]);
  const startMonth = normalizeOptionalInt(body["startMonth"]);
  const endMonth = normalizeOptionalInt(body["endMonth"]);
  if (!slug || !name || !startMonth || !endMonth) {
    res.status(400).json({ error: "slug, name, startMonth, and endMonth are required" });
    return;
  }
  const [created] = await db
    .insert(seasonalWindowsTable)
    .values({
      slug,
      name,
      engineType: normalizeNullableString(body["engineType"]) ?? null,
      targetCluster: normalizeNullableString(body["targetCluster"]) ?? null,
      startMonth,
      endMonth,
      note: normalizeNullableString(body["note"]) ?? null,
      updatedAt: new Date(),
    })
    .returning();
  res.status(201).json(created);
});

router.patch("/seasonal-windows/:id", async (req, res) => {
  const id = parseId(req.params["id"]);
  if (!id) {
    res.status(400).json({ error: "Invalid seasonal window identifier" });
    return;
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const [updated] = await db
    .update(seasonalWindowsTable)
    .set({
      slug: normalizeRequiredStringForPatch(body["slug"]),
      name: normalizeRequiredStringForPatch(body["name"]),
      engineType: normalizeNullableString(body["engineType"]),
      targetCluster: normalizeNullableString(body["targetCluster"]),
      startMonth: normalizeRequiredIntForPatch(body["startMonth"]),
      endMonth: normalizeRequiredIntForPatch(body["endMonth"]),
      note: normalizeNullableString(body["note"]),
      updatedAt: new Date(),
    })
    .where(eq(seasonalWindowsTable.id, id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Seasonal window not found" });
    return;
  }
  res.json(updated);
});

router.delete("/seasonal-windows/:id", async (req, res) => {
  const id = parseId(req.params["id"]);
  if (!id) {
    res.status(400).json({ error: "Invalid seasonal window identifier" });
    return;
  }
  await db.delete(seasonalWindowsTable).where(eq(seasonalWindowsTable.id, id));
  res.status(204).end();
});

router.get("/content-assets", async (_req, res) => {
  await ensureSlgReferenceData();
  const rows = await db.select().from(contentAssetsTable).orderBy(asc(contentAssetsTable.title));
  res.json(rows);
});

router.post("/content-assets", async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const slug = normalizeNullableString(body["slug"]);
  const assetType = normalizeNullableString(body["assetType"]);
  const title = normalizeNullableString(body["title"]);
  const bodyText = normalizeNullableString(body["body"]);
  if (!slug || !assetType || !title || !bodyText) {
    res.status(400).json({ error: "slug, assetType, title, and body are required" });
    return;
  }
  const [created] = await db
    .insert(contentAssetsTable)
    .values({
      slug,
      assetType,
      engineType: normalizeNullableString(body["engineType"]) ?? null,
      targetCluster: normalizeNullableString(body["targetCluster"]) ?? null,
      title,
      body: bodyText,
      active: normalizeOptionalBoolean(body["active"]) ?? true,
      updatedAt: new Date(),
    })
    .returning();
  res.status(201).json(created);
});

router.patch("/content-assets/:id", async (req, res) => {
  const id = parseId(req.params["id"]);
  if (!id) {
    res.status(400).json({ error: "Invalid content asset identifier" });
    return;
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const [updated] = await db
    .update(contentAssetsTable)
    .set({
      slug: normalizeRequiredStringForPatch(body["slug"]),
      assetType: normalizeRequiredStringForPatch(body["assetType"]),
      engineType: normalizeNullableString(body["engineType"]),
      targetCluster: normalizeNullableString(body["targetCluster"]),
      title: normalizeRequiredStringForPatch(body["title"]),
      body: normalizeRequiredStringForPatch(body["body"]),
      active: normalizeOptionalBoolean(body["active"]),
      updatedAt: new Date(),
    })
    .where(eq(contentAssetsTable.id, id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Content asset not found" });
    return;
  }
  res.json(updated);
});

router.delete("/content-assets/:id", async (req, res) => {
  const id = parseId(req.params["id"]);
  if (!id) {
    res.status(400).json({ error: "Invalid content asset identifier" });
    return;
  }
  await db.delete(contentAssetsTable).where(eq(contentAssetsTable.id, id));
  res.status(204).end();
});

router.get("/relationship-paths", async (req, res) => {
  const businessId = parseId(req.query["businessId"] as string | undefined);
  const rows = businessId
    ? await db
        .select({
          id: relationshipPathsTable.id,
          businessId: relationshipPathsTable.businessId,
          businessName: businessesTable.name,
          introducerName: relationshipPathsTable.introducerName,
          introducerOrg: relationshipPathsTable.introducerOrg,
          relationshipType: relationshipPathsTable.relationshipType,
          confidenceScore: relationshipPathsTable.confidenceScore,
          isWarm: relationshipPathsTable.isWarm,
          notes: relationshipPathsTable.notes,
          createdAt: relationshipPathsTable.createdAt,
          updatedAt: relationshipPathsTable.updatedAt,
        })
        .from(relationshipPathsTable)
        .leftJoin(businessesTable, eq(businessesTable.id, relationshipPathsTable.businessId))
        .where(eq(relationshipPathsTable.businessId, businessId))
        .orderBy(asc(relationshipPathsTable.createdAt))
    : await db
        .select({
          id: relationshipPathsTable.id,
          businessId: relationshipPathsTable.businessId,
          businessName: businessesTable.name,
          introducerName: relationshipPathsTable.introducerName,
          introducerOrg: relationshipPathsTable.introducerOrg,
          relationshipType: relationshipPathsTable.relationshipType,
          confidenceScore: relationshipPathsTable.confidenceScore,
          isWarm: relationshipPathsTable.isWarm,
          notes: relationshipPathsTable.notes,
          createdAt: relationshipPathsTable.createdAt,
          updatedAt: relationshipPathsTable.updatedAt,
        })
        .from(relationshipPathsTable)
        .leftJoin(businessesTable, eq(businessesTable.id, relationshipPathsTable.businessId))
        .orderBy(asc(relationshipPathsTable.createdAt));
  res.json(rows);
});

router.post("/relationship-paths", async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const businessId = normalizeOptionalInt(body["businessId"]);
  const relationshipType = normalizeNullableString(body["relationshipType"]);
  if (!businessId || !relationshipType) {
    res.status(400).json({ error: "businessId and relationshipType are required" });
    return;
  }
  const [created] = await db
    .insert(relationshipPathsTable)
    .values({
      businessId,
      relationshipType,
      introducerName: normalizeNullableString(body["introducerName"]) ?? null,
      introducerOrg: normalizeNullableString(body["introducerOrg"]) ?? null,
      confidenceScore: normalizeNullableString(body["confidenceScore"]) ?? "0.50",
      isWarm: normalizeOptionalBoolean(body["isWarm"]) ?? false,
      notes: normalizeNullableString(body["notes"]) ?? null,
      updatedAt: new Date(),
    })
    .returning();
  res.status(201).json(created);
});

router.patch("/relationship-paths/:id", async (req, res) => {
  const id = parseId(req.params["id"]);
  if (!id) {
    res.status(400).json({ error: "Invalid relationship path identifier" });
    return;
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const [updated] = await db
    .update(relationshipPathsTable)
    .set({
      introducerName: normalizeNullableString(body["introducerName"]),
      introducerOrg: normalizeNullableString(body["introducerOrg"]),
      relationshipType: normalizeRequiredStringForPatch(body["relationshipType"]),
      confidenceScore: normalizeRequiredStringForPatch(body["confidenceScore"]),
      isWarm: normalizeOptionalBoolean(body["isWarm"]),
      notes: normalizeNullableString(body["notes"]),
      updatedAt: new Date(),
    })
    .where(eq(relationshipPathsTable.id, id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Relationship path not found" });
    return;
  }
  res.json(updated);
});

router.delete("/relationship-paths/:id", async (req, res) => {
  const id = parseId(req.params["id"]);
  if (!id) {
    res.status(400).json({ error: "Invalid relationship path identifier" });
    return;
  }
  await db.delete(relationshipPathsTable).where(eq(relationshipPathsTable.id, id));
  res.status(204).end();
});

router.get("/strategic-accounts", async (req, res) => {
  const businessId = parseId(req.query["businessId"] as string | undefined);
  const rows = businessId
    ? await db
        .select({
          id: strategicAccountsTable.id,
          businessId: strategicAccountsTable.businessId,
          businessName: businessesTable.name,
          accountType: strategicAccountsTable.accountType,
          owner: strategicAccountsTable.owner,
          accountTier: strategicAccountsTable.accountTier,
          status: strategicAccountsTable.status,
          thesis: strategicAccountsTable.thesis,
          milestone: strategicAccountsTable.milestone,
          createdAt: strategicAccountsTable.createdAt,
          updatedAt: strategicAccountsTable.updatedAt,
        })
        .from(strategicAccountsTable)
        .leftJoin(businessesTable, eq(businessesTable.id, strategicAccountsTable.businessId))
        .where(eq(strategicAccountsTable.businessId, businessId))
        .orderBy(asc(strategicAccountsTable.createdAt))
    : await db
        .select({
          id: strategicAccountsTable.id,
          businessId: strategicAccountsTable.businessId,
          businessName: businessesTable.name,
          accountType: strategicAccountsTable.accountType,
          owner: strategicAccountsTable.owner,
          accountTier: strategicAccountsTable.accountTier,
          status: strategicAccountsTable.status,
          thesis: strategicAccountsTable.thesis,
          milestone: strategicAccountsTable.milestone,
          createdAt: strategicAccountsTable.createdAt,
          updatedAt: strategicAccountsTable.updatedAt,
        })
        .from(strategicAccountsTable)
        .leftJoin(businessesTable, eq(businessesTable.id, strategicAccountsTable.businessId))
        .orderBy(asc(strategicAccountsTable.createdAt));
  res.json(rows);
});

router.post("/strategic-accounts", async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const businessId = normalizeOptionalInt(body["businessId"]);
  const accountType = normalizeNullableString(body["accountType"]);
  if (!businessId || !accountType) {
    res.status(400).json({ error: "businessId and accountType are required" });
    return;
  }
  const [created] = await db
    .insert(strategicAccountsTable)
    .values({
      businessId,
      accountType,
      owner: normalizeNullableString(body["owner"]) ?? null,
      accountTier: normalizeNullableString(body["accountTier"]) ?? null,
      status: normalizeNullableString(body["status"]) ?? "active",
      thesis: normalizeNullableString(body["thesis"]) ?? null,
      milestone: normalizeNullableString(body["milestone"]) ?? null,
      updatedAt: new Date(),
    })
    .returning();
  res.status(201).json(created);
});

router.patch("/strategic-accounts/:id", async (req, res) => {
  const id = parseId(req.params["id"]);
  if (!id) {
    res.status(400).json({ error: "Invalid strategic account identifier" });
    return;
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const [updated] = await db
    .update(strategicAccountsTable)
    .set({
      owner: normalizeNullableString(body["owner"]),
      accountTier: normalizeNullableString(body["accountTier"]),
      status: normalizeRequiredStringForPatch(body["status"]),
      thesis: normalizeNullableString(body["thesis"]),
      milestone: normalizeNullableString(body["milestone"]),
      updatedAt: new Date(),
    })
    .where(eq(strategicAccountsTable.id, id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Strategic account not found" });
    return;
  }
  res.json(updated);
});

router.delete("/strategic-accounts/:id", async (req, res) => {
  const id = parseId(req.params["id"]);
  if (!id) {
    res.status(400).json({ error: "Invalid strategic account identifier" });
    return;
  }
  await db.delete(strategicAccountsTable).where(eq(strategicAccountsTable.id, id));
  res.status(204).end();
});

export default router;
