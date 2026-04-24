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
