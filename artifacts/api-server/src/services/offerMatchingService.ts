import type { Offer } from "@workspace/db";
import type { BusinessResearchAggregate } from "./businessResearchAggregateService";
import type { SlgClassification } from "./slgClassificationService";

function splitCsv(value: string | null | undefined) {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function matchBestOffer(
  aggregate: BusinessResearchAggregate,
  classification: SlgClassification,
  offers: Offer[],
) {
  const scored = offers
    .filter((offer) => offer.active)
    .map((offer) => {
      let score = 0;
      const clusters = splitCsv(offer.targetClusters);
      if (clusters.includes(classification.targetCluster)) score += 45;
      if (offer.engineType === classification.engineType) score += 25;
      if (offer.bundleable) score += 5;
      score += Math.min(25, Math.max(0, offer.recurringPotential ?? 0) / 4);

      if (classification.targetType === "buyer" && offer.engineType === "revenue") score += 10;
      if (classification.targetType === "host" && offer.offerType.includes("exhibition")) score += 10;
      if (classification.targetType === "funder" && offer.engineType === "institutional") score += 10;
      if (classification.targetType === "prestige" && offer.engineType === "authority") score += 8;
      if (classification.targetType === "referrer" && offer.bundleable) score += 6;
      if (aggregate.business.categorySlug === "design_boutique_hotel" && offer.offerType.includes("exhibition")) score += 8;
      if (aggregate.business.categorySlug === "art_museum" && offer.offerType.includes("curatorial")) score += 8;
      if (aggregate.business.categorySlug === "cultural_institute" && offer.offerType.includes("residency")) score += 8;
      if (aggregate.business.targetMarket && aggregate.business.targetMarket !== "IT" && offer.engineType === "authority") score += 6;
      if (classification.targetCluster === "boutique_hotel_hospitality" && aggregate.business.website) score += 5;
      if (classification.targetCluster === "commercial_collectors_ecosystem" && aggregate.business.targetMarket) score += 5;
      if (classification.engineType === "institutional" && aggregate.business.reviewRequired) score += 3;

      return { offer, score };
    })
    .sort((left, right) => right.score - left.score);

  const winner = scored[0] ?? null;
  return {
    bestOffer: winner?.offer ?? null,
    offerFitScore: Math.max(0, Math.min(100, Math.round(winner?.score ?? 0))),
    continuityRevenuePotential: Math.max(
      0,
      Math.min(100, winner?.offer?.recurringPotential ?? 0),
    ),
  };
}
