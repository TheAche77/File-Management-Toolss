import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db, importRunsTable } from "@workspace/db";
import { logger } from "../lib/logger";
import { runImport } from "./importOrchestrator";

const ACTIVE_STATUSES = ["queued", "running", "fetching", "merging"] as const;

const activeRunIds = new Set<number>();
const activeTargetKeys = new Set<string>();

function getTargetKey(categorySlug: string, city: string): string {
  return `${categorySlug}::${city.trim().toLowerCase()}`;
}

async function startQueuedImport(runId: number, categorySlug: string, city: string) {
  if (activeRunIds.has(runId)) return;

  const targetKey = getTargetKey(categorySlug, city);
  activeRunIds.add(runId);
  activeTargetKeys.add(targetKey);

  try {
    await runImport(categorySlug, city, runId);
  } catch (err) {
    logger.error({ err, runId, categorySlug, city }, "Queued import crashed");
  } finally {
    activeRunIds.delete(runId);
    activeTargetKeys.delete(targetKey);
  }
}

export async function queueImportRun(categorySlug: string, city: string): Promise<{
  accepted: boolean;
  runId: number;
  status: string;
}> {
  const normalizedCity = city.trim().toLowerCase();
  const targetKey = getTargetKey(categorySlug, city);

  const existing = await db
    .select({
      id: importRunsTable.id,
      status: importRunsTable.status,
    })
    .from(importRunsTable)
    .where(
      and(
        eq(importRunsTable.categorySlug, categorySlug),
        inArray(importRunsTable.status, [...ACTIVE_STATUSES]),
        sql`lower(${importRunsTable.city}) = ${normalizedCity}`,
      ),
    )
    .orderBy(desc(importRunsTable.startedAt))
    .limit(1);

  if (existing.length > 0) {
    return {
      accepted: false,
      runId: existing[0]!.id,
      status: existing[0]!.status,
    };
  }

  const [runRow] = await db
    .insert(importRunsTable)
    .values({
      source: "pending",
      categorySlug,
      city,
      status: "queued",
      fetched: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
    })
    .returning({ id: importRunsTable.id, status: importRunsTable.status });

  const runId = runRow?.id;
  if (!runId) {
    throw new Error("Failed to create import run");
  }

  queueMicrotask(() => {
    void startQueuedImport(runId, categorySlug, city);
  });

  logger.info({ runId, categorySlug, city, targetKey }, "Import queued");

  return {
    accepted: true,
    runId,
    status: runRow?.status ?? "queued",
  };
}

export async function resumePendingImportRuns(): Promise<void> {
  const pendingRuns = await db
    .select({
      id: importRunsTable.id,
      categorySlug: importRunsTable.categorySlug,
      city: importRunsTable.city,
      status: importRunsTable.status,
    })
    .from(importRunsTable)
    .where(inArray(importRunsTable.status, [...ACTIVE_STATUSES]))
    .orderBy(importRunsTable.startedAt);

  for (const run of pendingRuns) {
    const targetKey = getTargetKey(run.categorySlug, run.city);
    if (activeRunIds.has(run.id) || activeTargetKeys.has(targetKey)) {
      continue;
    }

    logger.info({ runId: run.id, status: run.status }, "Resuming pending import run");
    queueMicrotask(() => {
      void startQueuedImport(run.id, run.categorySlug, run.city);
    });
  }
}

export function isActiveImportStatus(status: string): boolean {
  return ACTIVE_STATUSES.includes(status as (typeof ACTIVE_STATUSES)[number]);
}
