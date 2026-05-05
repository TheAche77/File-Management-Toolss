import type { Narrative } from "@workspace/db";
import type { SlgClassification } from "./slgClassificationService";

function splitCsv(value: string | null | undefined) {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function selectBestNarratives(
  classification: SlgClassification,
  narratives: Narrative[],
) {
  const scored = narratives
    .filter((narrative) => narrative.active)
    .map((narrative) => {
      let score = 0;
      if (splitCsv(narrative.targetClusters).includes(classification.targetCluster)) score += 45;
      if (splitCsv(narrative.engineTypes).includes(classification.engineType)) score += 25;
      if (narrative.slug === "tuscany-uniqueness" && classification.engineType !== "institutional") score += 8;
      if (narrative.slug === "labirinto-platform" && classification.targetCluster === "residency_exchange_diplomacy") score += 12;
      if (narrative.slug === "urban-art-authority" && classification.engineType === "authority") score += 12;
      if (narrative.slug === "institutional-bridge" && classification.engineType === "institutional") score += 12;
      if (narrative.slug === "cultural-impact-social-value" && classification.targetCluster === "foundations_csr_philanthropy") score += 10;
      if (narrative.slug === "living-artist-ecosystem" && classification.targetType === "buyer") score += 8;
      if (narrative.slug === "florence-strategic-node" && classification.targetCluster === "boutique_hotel_hospitality") score += 10;
      return { narrative, score };
    })
    .sort((left, right) => right.score - left.score);

  return {
    bestNarrative: scored[0]?.narrative ?? null,
    secondaryNarrative: scored[1]?.narrative ?? null,
    toneOfApproach: scored[0]?.narrative?.toneOfApproach ?? null,
    recommendedPitchAngle: scored[0]?.narrative?.summary ?? null,
  };
}
