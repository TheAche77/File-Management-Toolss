import {
  businessSourcesTable,
  businessesTable,
  contactCandidatesTable,
  db,
  type Business,
  type BusinessSource,
  type ContactCandidate,
} from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

export interface BusinessResearchAggregate {
  business: Business;
  sources: BusinessSource[];
  contactCandidates: ContactCandidate[];
}

export async function loadBusinessResearchAggregatesByIds(
  businessIds: number[],
): Promise<BusinessResearchAggregate[]> {
  if (businessIds.length === 0) return [];

  const uniqueIds = Array.from(new Set(businessIds.filter((id) => Number.isFinite(id) && id > 0)));
  if (uniqueIds.length === 0) return [];

  const [businesses, sources, contactCandidates] = await Promise.all([
    db.select().from(businessesTable).where(inArray(businessesTable.id, uniqueIds)),
    db
      .select()
      .from(businessSourcesTable)
      .where(inArray(businessSourcesTable.businessId, uniqueIds)),
    db
      .select()
      .from(contactCandidatesTable)
      .where(inArray(contactCandidatesTable.businessId, uniqueIds)),
  ]);

  const sourcesByBusinessId = new Map<number, BusinessSource[]>();
  for (const source of sources) {
    const records = sourcesByBusinessId.get(source.businessId);
    if (records) {
      records.push(source);
    } else {
      sourcesByBusinessId.set(source.businessId, [source]);
    }
  }

  const candidatesByBusinessId = new Map<number, ContactCandidate[]>();
  for (const candidate of contactCandidates) {
    const records = candidatesByBusinessId.get(candidate.businessId);
    if (records) {
      records.push(candidate);
    } else {
      candidatesByBusinessId.set(candidate.businessId, [candidate]);
    }
  }

  return businesses.map((business) => ({
    business,
    sources: sourcesByBusinessId.get(business.id) ?? [],
    contactCandidates: candidatesByBusinessId.get(business.id) ?? [],
  }));
}

export async function loadBusinessResearchAggregateById(
  businessId: number,
): Promise<BusinessResearchAggregate | null> {
  if (!Number.isFinite(businessId) || businessId <= 0) return null;

  const businessRows = await db
    .select()
    .from(businessesTable)
    .where(eq(businessesTable.id, businessId))
    .limit(1);

  const business = businessRows[0];
  if (!business) return null;

  const [sources, contactCandidates] = await Promise.all([
    db
      .select()
      .from(businessSourcesTable)
      .where(eq(businessSourcesTable.businessId, businessId)),
    db
      .select()
      .from(contactCandidatesTable)
      .where(eq(contactCandidatesTable.businessId, businessId)),
  ]);

  return {
    business,
    sources,
    contactCandidates,
  };
}
