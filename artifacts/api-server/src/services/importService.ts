import { db, importRunsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { fetchRomeGalleries } from "./overpassService";
import { normalizeElements } from "./galleryNormalizer";
import { upsertGallery } from "./dedupeService";
import { logger } from "../lib/logger";

export interface ImportStats {
  fetched: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: number;
}

export async function importRomeFromOsm(): Promise<{
  success: boolean;
  stats: ImportStats;
  message: string;
  runId: number | null;
}> {
  const [runRow] = await db
    .insert(importRunsTable)
    .values({
      source: "osm",
      city: "Rome",
      status: "running",
    })
    .returning({ id: importRunsTable.id });

  const runId = runRow?.id ?? null;
  const stats: ImportStats = {
    fetched: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
  };

  try {
    const elements = await fetchRomeGalleries();
    stats.fetched = elements.length;

    const normalized = normalizeElements(elements);
    logger.info({ normalized: normalized.length }, "Normalized gallery records");

    for (const gallery of normalized) {
      try {
        const result = await upsertGallery(gallery);
        if (result.action === "insert") stats.inserted++;
        else if (result.action === "update") stats.updated++;
        else stats.skipped++;
      } catch (err) {
        stats.errors++;
        logger.warn({ err, name: gallery.name }, "Error upserting gallery");
      }
    }

    if (runId) {
      await db
        .update(importRunsTable)
        .set({
          status: "completed",
          fetched: stats.fetched,
          inserted: stats.inserted,
          updated: stats.updated,
          skipped: stats.skipped,
          errors: stats.errors,
          finishedAt: new Date(),
        })
        .where(eq(importRunsTable.id, runId));
    }

    return {
      success: true,
      stats,
      message: `Import completed: ${stats.inserted} inserted, ${stats.updated} updated, ${stats.errors} errors`,
      runId,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown import error";
    logger.error({ err }, "Import failed");

    if (runId) {
      await db
        .update(importRunsTable)
        .set({
          status: "failed",
          errorMessage: message,
          finishedAt: new Date(),
        })
        .where(eq(importRunsTable.id, runId));
    }

    return { success: false, stats, message, runId };
  }
}
