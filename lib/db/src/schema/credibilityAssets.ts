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

export const credibilityAssetsTable = pgTable(
  "credibility_assets",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    assetType: text("asset_type").notNull(),
    summary: text("summary"),
    sourceUrl: text("source_url"),
    targetClusters: text("target_clusters"),
    engineTypes: text("engine_types"),
    tags: text("tags"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("credibility_assets_slug_idx").on(t.slug),
    index("credibility_assets_type_idx").on(t.assetType),
    index("credibility_assets_active_idx").on(t.active),
  ],
);

export const insertCredibilityAssetSchema = createInsertSchema(credibilityAssetsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCredibilityAsset = z.infer<typeof insertCredibilityAssetSchema>;
export type CredibilityAsset = typeof credibilityAssetsTable.$inferSelect;
