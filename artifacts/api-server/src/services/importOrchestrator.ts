import { db, importRunsTable, categoriesTable } from "@workspace/db";
import type { InsertImportRun } from "@workspace/db";
import { eq } from "drizzle-orm";
import { OverpassConnector } from "../connectors/overpassConnector";
import { GooglePlacesConnector } from "../connectors/googlePlacesConnector";
import { bulkMergeBusinesses } from "./dedupeService";
import { logger } from "../lib/logger";
import type { ConnectorOptions } from "../connectors/types";

export interface ImportStats {
  fetched: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: number;
}

const connectors = [new OverpassConnector(), new GooglePlacesConnector()];

async function updateImportRun(runId: number | null, values: Partial<InsertImportRun>) {
  if (!runId) return;

  await db
    .update(importRunsTable)
    .set(values)
    .where(eq(importRunsTable.id, runId));
}

export async function runImport(categorySlug: string, city: string): Promise<{
  success: boolean;
  stats: ImportStats;
  message: string;
  runId: number | null;
}>;
export async function runImport(categorySlug: string, city: string, existingRunId: number): Promise<{
  success: boolean;
  stats: ImportStats;
  message: string;
  runId: number | null;
}>;
export async function runImport(categorySlug: string, city: string, existingRunId?: number): Promise<{
  success: boolean;
  stats: ImportStats;
  message: string;
  runId: number | null;
}> {
  const categories = await db
    .select()
    .from(categoriesTable)
    .where(eq(categoriesTable.slug, categorySlug))
    .limit(1);

  if (categories.length === 0) {
    return {
      success: false,
      stats: { fetched: 0, inserted: 0, updated: 0, skipped: 0, errors: 0 },
      message: `Unknown category: ${categorySlug}`,
      runId: null,
    };
  }

  const category = categories[0]!;

  const activeConnectors = connectors.filter((c) => c.isAvailable());
  let runId = existingRunId ?? null;

  if (!runId) {
    const [runRow] = await db
      .insert(importRunsTable)
      .values({
        source: activeConnectors.map((connector) => connector.name).join("+") || "none",
        categorySlug,
        city,
        status: "running",
        fetched: 0,
        inserted: 0,
        updated: 0,
        skipped: 0,
        errors: 0,
      })
      .returning({ id: importRunsTable.id });

    runId = runRow?.id ?? null;
  } else {
    await updateImportRun(runId, {
      source: activeConnectors.map((connector) => connector.name).join("+") || "none",
      status: "running",
      errorMessage: null,
      fetched: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      finishedAt: null,
    });
  }

  const stats: ImportStats = { fetched: 0, inserted: 0, updated: 0, skipped: 0, errors: 0 };

  try {
    const opts: ConnectorOptions = {
      categorySlug,
      city,
      osmTags: category.osmTags,
    };

    logger.info({ connectors: activeConnectors.map((c) => c.name), categorySlug, city }, "Running import");

    for (const connector of activeConnectors) {
      await updateImportRun(runId, {
        status: "fetching",
        source: connector.name,
        fetched: stats.fetched,
        inserted: stats.inserted,
        updated: stats.updated,
        skipped: stats.skipped,
        errors: stats.errors,
      });

      const result = await connector.fetch(opts);
      stats.fetched += result.items.length;
      stats.errors += result.errors.length;

      await updateImportRun(runId, {
        status: result.items.length > 0 ? "merging" : "running",
        source: connector.name,
        fetched: stats.fetched,
        inserted: stats.inserted,
        updated: stats.updated,
        skipped: stats.skipped,
        errors: stats.errors,
      });

      if (result.items.length === 0) {
        continue;
      }

      try {
        const mergeStats = await bulkMergeBusinesses(result.items);
        stats.inserted += mergeStats.inserted;
        stats.updated += mergeStats.updated;
        stats.skipped += mergeStats.skipped;
      } catch (err) {
        stats.errors += result.items.length;
        logger.warn({ err, connector: connector.name }, "Error bulk merging businesses");
      }

      await updateImportRun(runId, {
        status: "running",
        source: connector.name,
        fetched: stats.fetched,
        inserted: stats.inserted,
        updated: stats.updated,
        skipped: stats.skipped,
        errors: stats.errors,
      });
    }

    await updateImportRun(runId, {
      status: "completed",
      source: activeConnectors.map((connector) => connector.name).join("+") || "none",
      fetched: stats.fetched,
      inserted: stats.inserted,
      updated: stats.updated,
      skipped: stats.skipped,
      errors: stats.errors,
      finishedAt: new Date(),
    });

    return {
      success: true,
      stats,
      message: `Import completed: ${stats.inserted} inserted, ${stats.updated} updated, ${stats.errors} errors`,
      runId,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error({ err }, "Import failed");
    await updateImportRun(runId, {
      status: "failed",
      errorMessage: message,
      fetched: stats.fetched,
      inserted: stats.inserted,
      updated: stats.updated,
      skipped: stats.skipped,
      errors: stats.errors,
      finishedAt: new Date(),
    });
    return { success: false, stats, message, runId };
  }
}
