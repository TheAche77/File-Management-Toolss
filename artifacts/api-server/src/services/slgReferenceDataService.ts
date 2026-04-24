import {
  caseStudiesTable,
  contentAssetsTable,
  credibilityAssetsTable,
  db,
  narrativesTable,
  offersTable,
  seasonalWindowsTable,
} from "@workspace/db";
import { asc, eq } from "drizzle-orm";
import {
  DEFAULT_SLG_CASE_STUDIES,
  DEFAULT_SLG_CONTENT_ASSETS,
  DEFAULT_SLG_CREDIBILITY_ASSETS,
  DEFAULT_SLG_NARRATIVES,
  DEFAULT_SLG_OFFERS,
  DEFAULT_SLG_SEASONAL_WINDOWS,
} from "../lib/slgDefaults";

async function ensureOffers() {
  const existing = await db.select({ id: offersTable.id }).from(offersTable).limit(1);
  if (existing.length > 0) return;
  await db.insert(offersTable).values(DEFAULT_SLG_OFFERS.map((entry) => ({
    ...entry,
    active: true,
    updatedAt: new Date(),
  }))).onConflictDoNothing();
}

async function ensureNarratives() {
  const existing = await db.select({ id: narrativesTable.id }).from(narrativesTable).limit(1);
  if (existing.length > 0) return;
  await db.insert(narrativesTable).values(DEFAULT_SLG_NARRATIVES.map((entry) => ({
    ...entry,
    active: true,
    updatedAt: new Date(),
  }))).onConflictDoNothing();
}

async function ensureCredibilityAssets() {
  const existing = await db.select({ id: credibilityAssetsTable.id }).from(credibilityAssetsTable).limit(1);
  if (existing.length > 0) return;
  await db.insert(credibilityAssetsTable).values(DEFAULT_SLG_CREDIBILITY_ASSETS.map((entry) => ({
    ...entry,
    active: true,
    updatedAt: new Date(),
  }))).onConflictDoNothing();
}

async function ensureCaseStudies() {
  const existing = await db.select({ id: caseStudiesTable.id }).from(caseStudiesTable).limit(1);
  if (existing.length > 0) return;
  await db.insert(caseStudiesTable).values(DEFAULT_SLG_CASE_STUDIES.map((entry) => ({
    ...entry,
    active: true,
    updatedAt: new Date(),
  }))).onConflictDoNothing();
}

async function ensureSeasonalWindows() {
  const existing = await db.select({ id: seasonalWindowsTable.id }).from(seasonalWindowsTable).limit(1);
  if (existing.length > 0) return;
  await db.insert(seasonalWindowsTable).values(DEFAULT_SLG_SEASONAL_WINDOWS.map((entry) => ({
    ...entry,
    updatedAt: new Date(),
  }))).onConflictDoNothing();
}

async function ensureContentAssets() {
  const existing = await db.select({ id: contentAssetsTable.id }).from(contentAssetsTable).limit(1);
  if (existing.length > 0) return;
  await db.insert(contentAssetsTable).values(DEFAULT_SLG_CONTENT_ASSETS.map((entry) => ({
    ...entry,
    active: true,
    updatedAt: new Date(),
  }))).onConflictDoNothing();
}

export async function ensureSlgReferenceData() {
  await Promise.all([
    ensureOffers(),
    ensureNarratives(),
    ensureCredibilityAssets(),
    ensureCaseStudies(),
    ensureSeasonalWindows(),
    ensureContentAssets(),
  ]);
}

export async function listOffers() {
  await ensureOffers();
  return db.select().from(offersTable).orderBy(asc(offersTable.name));
}

export async function listNarratives() {
  await ensureNarratives();
  return db.select().from(narrativesTable).orderBy(asc(narrativesTable.name));
}

export async function listCredibilityAssets() {
  await ensureCredibilityAssets();
  return db.select().from(credibilityAssetsTable).orderBy(asc(credibilityAssetsTable.name));
}

export async function listCaseStudies() {
  await ensureCaseStudies();
  return db.select().from(caseStudiesTable).orderBy(asc(caseStudiesTable.title));
}

export async function listSeasonalWindows() {
  await ensureSeasonalWindows();
  return db.select().from(seasonalWindowsTable).orderBy(asc(seasonalWindowsTable.name));
}

export async function listContentAssets() {
  await ensureContentAssets();
  return db.select().from(contentAssetsTable).orderBy(asc(contentAssetsTable.title));
}

export async function getOfferById(id: number) {
  await ensureOffers();
  const rows = await db.select().from(offersTable).where(eq(offersTable.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getNarrativeById(id: number) {
  await ensureNarratives();
  const rows = await db.select().from(narrativesTable).where(eq(narrativesTable.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getCredibilityAssetById(id: number) {
  await ensureCredibilityAssets();
  const rows = await db.select().from(credibilityAssetsTable).where(eq(credibilityAssetsTable.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getCaseStudyById(id: number) {
  await ensureCaseStudies();
  const rows = await db.select().from(caseStudiesTable).where(eq(caseStudiesTable.id, id)).limit(1);
  return rows[0] ?? null;
}
