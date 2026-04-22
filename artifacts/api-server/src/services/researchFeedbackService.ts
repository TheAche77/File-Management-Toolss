import { db, outreachEventsTable } from "@workspace/db";
import { desc } from "drizzle-orm";

const FEEDBACK_FIELDS = new Set([
  "assignedArtistSource",
  "assigned_artist_source",
  "isPrimary",
  "is_primary",
  "reviewStatus",
  "review_status",
]);

export async function getResearchFeedbackSummary(limit = 250) {
  const events = await db
    .select()
    .from(outreachEventsTable)
    .orderBy(desc(outreachEventsTable.createdAt))
    .limit(limit);

  let manualArtistOverrides = 0;
  let primaryContactOverrides = 0;
  let reviewCorrections = 0;

  for (const event of events) {
    const changed = event.changedFields ?? [];
    if (changed.some((field) => FEEDBACK_FIELDS.has(field))) {
      if (changed.some((field) => field === "assignedArtistSource" || field === "assigned_artist_source")) {
        manualArtistOverrides += 1;
      }
      if (changed.some((field) => field === "isPrimary" || field === "is_primary")) {
        primaryContactOverrides += 1;
      }
      if (changed.some((field) => field === "reviewStatus" || field === "review_status")) {
        reviewCorrections += 1;
      }
    }
  }

  return {
    recentEvents: events.length,
    manualArtistOverrides,
    primaryContactOverrides,
    reviewCorrections,
  };
}
