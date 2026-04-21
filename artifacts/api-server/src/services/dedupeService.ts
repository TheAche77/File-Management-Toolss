import { db, galleriesTable } from "@workspace/db";
import { and, eq, or, sql } from "drizzle-orm";
import type { InsertGallery } from "@workspace/db";
import { logger } from "../lib/logger";

const COORD_TOLERANCE = 0.0005;

export type DedupeResult = "insert" | "update" | "skip";

export async function resolveGallery(
  incoming: InsertGallery,
): Promise<{ action: DedupeResult; id?: number }> {
  if (incoming.osmId && incoming.osmType) {
    const existing = await db
      .select({ id: galleriesTable.id })
      .from(galleriesTable)
      .where(
        and(
          eq(galleriesTable.osmId, incoming.osmId),
          eq(galleriesTable.osmType, incoming.osmType),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      return { action: "update", id: existing[0]!.id };
    }
  }

  const lat = parseFloat(incoming.latitude);
  const lon = parseFloat(incoming.longitude);

  const coordMatch = await db
    .select({ id: galleriesTable.id })
    .from(galleriesTable)
    .where(
      and(
        sql`abs(${galleriesTable.latitude}::float - ${lat}) < ${COORD_TOLERANCE}`,
        sql`abs(${galleriesTable.longitude}::float - ${lon}) < ${COORD_TOLERANCE}`,
        eq(galleriesTable.name, incoming.name),
      ),
    )
    .limit(1);

  if (coordMatch.length > 0) {
    return { action: "update", id: coordMatch[0]!.id };
  }

  if (incoming.website) {
    const websiteMatch = await db
      .select({ id: galleriesTable.id })
      .from(galleriesTable)
      .where(eq(galleriesTable.website, incoming.website))
      .limit(1);

    if (websiteMatch.length > 0) {
      return { action: "update", id: websiteMatch[0]!.id };
    }
  }

  if (incoming.phone) {
    const phoneMatch = await db
      .select({ id: galleriesTable.id })
      .from(galleriesTable)
      .where(eq(galleriesTable.phone, incoming.phone))
      .limit(1);

    if (phoneMatch.length > 0) {
      return { action: "update", id: phoneMatch[0]!.id };
    }
  }

  return { action: "insert" };
}

export async function upsertGallery(
  incoming: InsertGallery,
): Promise<{ action: DedupeResult; id: number }> {
  const resolved = await resolveGallery(incoming);

  if (resolved.action === "insert") {
    const inserted = await db
      .insert(galleriesTable)
      .values(incoming)
      .returning({ id: galleriesTable.id });
    const id = inserted[0]!.id;
    logger.debug({ id, name: incoming.name }, "Gallery inserted");
    return { action: "insert", id };
  } else {
    const id = resolved.id!;
    await db
      .update(galleriesTable)
      .set({
        ...incoming,
        updatedAt: new Date(),
      })
      .where(eq(galleriesTable.id, id));
    logger.debug({ id, name: incoming.name }, "Gallery updated");
    return { action: "update", id };
  }
}
