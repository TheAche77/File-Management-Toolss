import {
  db,
  outreachEventsTable,
  type Business,
  type ContactCandidate,
} from "@workspace/db";
import { desc, eq } from "drizzle-orm";

type SerializableAuditValue = string | number | boolean | null;

type FieldDiff = {
  field: string;
  before: SerializableAuditValue;
  after: SerializableAuditValue;
};

function normalizeAuditValue(value: unknown): SerializableAuditValue {
  if (value === undefined) return null;
  if (value === null) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }

  return JSON.stringify(value);
}

function buildDiffs<T extends Record<string, unknown>>(
  before: T,
  after: T,
  fields: string[],
): FieldDiff[] {
  return fields
    .map((field) => ({
      field,
      before: normalizeAuditValue(before[field]),
      after: normalizeAuditValue(after[field]),
    }))
    .filter((diff) => diff.before !== diff.after);
}

function formatFieldLabel(field: string) {
  return field
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}

export async function recordOutreachUpdate(before: Business, after: Business) {
  const fields = [
    "outreachStatus",
    "contactName",
    "contactRole",
    "contactEmail",
    "lastContactDate",
    "nextActionDate",
    "assignedArtist",
    "assignedArtistSource",
    "avatarType",
    "targetMarket",
    "warmConnection",
    "notes",
  ];

  const diffs = buildDiffs(before as unknown as Record<string, unknown>, after as unknown as Record<string, unknown>, fields);
  if (diffs.length === 0) return;

  await db.insert(outreachEventsTable).values({
    businessId: after.id,
    eventType: "outreach_updated",
    entityType: "business",
    actorType: "admin_token",
    summary: `Updated outreach fields: ${diffs.map((diff) => formatFieldLabel(diff.field)).join(", ")}`,
    changedFields: diffs.map((diff) => diff.field),
    payload: {
      diffs,
    },
  });
}

export async function recordContactCandidateUpdate(
  businessId: number,
  before: ContactCandidate,
  after: ContactCandidate,
) {
  const fields = ["reviewStatus", "isPrimary"];
  const diffs = buildDiffs(before as unknown as Record<string, unknown>, after as unknown as Record<string, unknown>, fields);
  if (diffs.length === 0) return;

  const summary =
    after.isPrimary && !before.isPrimary
      ? `Promoted contact candidate #${after.id} to primary`
      : `Updated contact candidate #${after.id}: ${diffs.map((diff) => formatFieldLabel(diff.field)).join(", ")}`;

  await db.insert(outreachEventsTable).values({
    businessId,
    eventType: "contact_candidate_updated",
    entityType: "contact_candidate",
    entityId: after.id,
    actorType: "admin_token",
    summary,
    changedFields: diffs.map((diff) => diff.field),
    payload: {
      candidateId: after.id,
      contactType: after.contactType,
      diffs,
    },
  });
}

export async function getOutreachEvents(businessId: number, limit = 25) {
  return db
    .select()
    .from(outreachEventsTable)
    .where(eq(outreachEventsTable.businessId, businessId))
    .orderBy(desc(outreachEventsTable.createdAt))
    .limit(limit);
}
