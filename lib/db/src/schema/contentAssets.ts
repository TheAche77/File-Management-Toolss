import {
  boolean,
  index,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const contentAssetsTable = pgTable(
  "content_assets",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    assetType: text("asset_type").notNull(),
    engineType: text("engine_type"),
    targetCluster: text("target_cluster"),
    title: text("title").notNull(),
    body: text("body").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("content_assets_slug_idx").on(t.slug),
    index("content_assets_type_idx").on(t.assetType),
    index("content_assets_engine_idx").on(t.engineType),
    index("content_assets_cluster_idx").on(t.targetCluster),
  ],
);

export const insertContentAssetSchema = createInsertSchema(contentAssetsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertContentAsset = z.infer<typeof insertContentAssetSchema>;
export type ContentAsset = typeof contentAssetsTable.$inferSelect;
