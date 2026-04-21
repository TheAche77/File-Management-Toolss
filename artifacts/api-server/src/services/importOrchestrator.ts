import { db, importRunsTable, categoriesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { OverpassConnector } from "../connectors/overpassConnector";
import { GooglePlacesConnector } from "../connectors/googlePlacesConnector";
import { upsertBusiness } from "./dedupeService";
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

export async function runImport(categorySlug: string, city: string): Promise<{
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

  const [runRow] = await db
    .insert(importRunsTable)
    .values({ source: "osm", categorySlug, city, status: "running" })
    .returning({ id: importRunsTable.id });

  const runId = runRow?.id ?? null;
  const stats: ImportStats = { fetched: 0, inserted: 0, updated: 0, skipped: 0, errors: 0 };

  try {
    const opts: ConnectorOptions = {
      categorySlug,
      city,
      osmTags: category.osmTags,
    };

    const activeConnectors = connectors.filter((c) => c.isAvailable());
    logger.info({ connectors: activeConnectors.map((c) => c.name), categorySlug, city }, "Running import");

    for (const connector of activeConnectors) {
      const result = await connector.fetch(opts);
      stats.fetched += result.items.length;
      stats.errors += result.errors.length;

      for (const item of result.items) {
        try {
          const r = await upsertBusiness(item);
          if (r.action === "insert") stats.inserted++;
          else stats.updated++;
        } catch (err) {
          stats.errors++;
          logger.warn({ err, name: item.name }, "Error upserting business");
        }
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
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error({ err }, "Import failed");
    if (runId) {
      await db
        .update(importRunsTable)
        .set({ status: "failed", errorMessage: message, finishedAt: new Date() })
        .where(eq(importRunsTable.id, runId));
    }
    return { success: false, stats, message, runId };
  }
}
