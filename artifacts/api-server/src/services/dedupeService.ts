import { db, businessesTable } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import type { InsertBusiness } from "@workspace/db";
import { logger } from "../lib/logger";

export type DedupeAction = "insert" | "update";

const COORD_TOLERANCE = 0.0005;

export async function upsertBusiness(
  incoming: InsertBusiness,
): Promise<{ action: DedupeAction; id: number }> {
  if (incoming.osmId && incoming.osmType) {
    const existing = await db
      .select({ id: businessesTable.id })
      .from(businessesTable)
      .where(
        and(
          eq(businessesTable.categorySlug, incoming.categorySlug),
          eq(businessesTable.osmId, incoming.osmId),
          eq(businessesTable.osmType, incoming.osmType),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      const id = existing[0]!.id;
      await db
        .update(businessesTable)
        .set({ ...incoming, updatedAt: new Date() })
        .where(eq(businessesTable.id, id));
      logger.debug({ id, name: incoming.name }, "Business updated (osm_id match)");
      return { action: "update", id };
    }
  }

  const lat = parseFloat(incoming.latitude);
  const lon = parseFloat(incoming.longitude);

  const coordMatch = await db
    .select({ id: businessesTable.id })
    .from(businessesTable)
    .where(
      and(
        eq(businessesTable.categorySlug, incoming.categorySlug),
        eq(businessesTable.name, incoming.name),
        sql`abs(${businessesTable.latitude}::float - ${lat}) < ${COORD_TOLERANCE}`,
        sql`abs(${businessesTable.longitude}::float - ${lon}) < ${COORD_TOLERANCE}`,
      ),
    )
    .limit(1);

  if (coordMatch.length > 0) {
    const id = coordMatch[0]!.id;
    await db
      .update(businessesTable)
      .set({ ...incoming, updatedAt: new Date() })
      .where(eq(businessesTable.id, id));
    logger.debug({ id, name: incoming.name }, "Business updated (coord+name match)");
    return { action: "update", id };
  }

  if (incoming.website) {
    const webMatch = await db
      .select({ id: businessesTable.id })
      .from(businessesTable)
      .where(
        and(
          eq(businessesTable.categorySlug, incoming.categorySlug),
          eq(businessesTable.website, incoming.website),
        ),
      )
      .limit(1);
    if (webMatch.length > 0) {
      const id = webMatch[0]!.id;
      await db.update(businessesTable).set({ ...incoming, updatedAt: new Date() }).where(eq(businessesTable.id, id));
      return { action: "update", id };
    }
  }

  const inserted = await db
    .insert(businessesTable)
    .values(incoming)
    .onConflictDoNothing()
    .returning({ id: businessesTable.id });

  if (inserted.length === 0) {
    const existing = await db
      .select({ id: businessesTable.id })
      .from(businessesTable)
      .where(
        and(
          eq(businessesTable.slug, incoming.slug),
          eq(businessesTable.categorySlug, incoming.categorySlug),
        ),
      )
      .limit(1);
    const id = existing[0]?.id ?? 0;
    return { action: "update", id };
  }

  logger.debug({ id: inserted[0]!.id, name: incoming.name }, "Business inserted");
  return { action: "insert", id: inserted[0]!.id };
}
