import {
  db,
  researchViewsTable,
  type InsertResearchView,
} from "@workspace/db";
import { asc, eq } from "drizzle-orm";

export async function listResearchViews() {
  return db
    .select()
    .from(researchViewsTable)
    .orderBy(asc(researchViewsTable.isDefault), asc(researchViewsTable.name));
}

export async function createResearchView(input: {
  name: string;
  scope?: string;
  isDefault?: boolean;
  filtersJson?: Record<string, unknown>;
  sortJson?: Record<string, unknown>;
}) {
  if (input.isDefault) {
    await db.update(researchViewsTable).set({ isDefault: false, updatedAt: new Date() });
  }

  const values: InsertResearchView = {
    name: input.name,
    scope: input.scope ?? "global",
    isDefault: input.isDefault ?? false,
    filtersJson: input.filtersJson ?? {},
    sortJson: input.sortJson ?? {},
  };

  const [created] = await db.insert(researchViewsTable).values(values).returning();
  return created ?? null;
}

export async function updateResearchView(
  id: number,
  input: Partial<{
    name: string;
    scope: string;
    isDefault: boolean;
    filtersJson: Record<string, unknown>;
    sortJson: Record<string, unknown>;
  }>,
) {
  if (input.isDefault) {
    await db
      .update(researchViewsTable)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(eq(researchViewsTable.isDefault, true));
  }

  const [updated] = await db
    .update(researchViewsTable)
    .set({
      ...input,
      updatedAt: new Date(),
    })
    .where(eq(researchViewsTable.id, id))
    .returning();

  return updated ?? null;
}

export async function deleteResearchView(id: number) {
  const [deleted] = await db
    .delete(researchViewsTable)
    .where(eq(researchViewsTable.id, id))
    .returning({ id: researchViewsTable.id });
  return Boolean(deleted);
}
