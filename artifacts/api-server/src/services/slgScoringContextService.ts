import {
  db,
  relationshipPathsTable,
  type CaseStudy,
  type ContentAsset,
  type CredibilityAsset,
  type Narrative,
  type Offer,
  type RelationshipPath,
  type SeasonalWindow,
} from "@workspace/db";
import { inArray } from "drizzle-orm";
import {
  ensureSlgReferenceData,
  listCaseStudies,
  listContentAssets,
  listCredibilityAssets,
  listNarratives,
  listOffers,
  listSeasonalWindows,
} from "./slgReferenceDataService";

export interface SlgScoringContext {
  offers: Offer[];
  narratives: Narrative[];
  credibilityAssets: CredibilityAsset[];
  caseStudies: CaseStudy[];
  seasonalWindows: SeasonalWindow[];
  contentAssets: ContentAsset[];
  relationshipPathsByBusinessId: Map<number, RelationshipPath[]>;
}

export async function loadSlgScoringContext(
  businessIds: number[],
): Promise<SlgScoringContext> {
  await ensureSlgReferenceData();

  const [offers, narratives, credibilityAssets, caseStudies, seasonalWindows, contentAssets, relationshipPaths] =
    await Promise.all([
      listOffers(),
      listNarratives(),
      listCredibilityAssets(),
      listCaseStudies(),
      listSeasonalWindows(),
      listContentAssets(),
      businessIds.length > 0
        ? db
            .select()
            .from(relationshipPathsTable)
            .where(inArray(relationshipPathsTable.businessId, businessIds))
        : Promise.resolve([] as RelationshipPath[]),
    ]);

  const relationshipPathsByBusinessId = new Map<number, RelationshipPath[]>();
  for (const path of relationshipPaths) {
    const current = relationshipPathsByBusinessId.get(path.businessId);
    if (current) current.push(path);
    else relationshipPathsByBusinessId.set(path.businessId, [path]);
  }

  return {
    offers,
    narratives,
    credibilityAssets,
    caseStudies,
    seasonalWindows,
    contentAssets,
    relationshipPathsByBusinessId,
  };
}
