import type { RelationshipPath } from "@workspace/db";

function parseConfidence(value: string | null | undefined) {
  const numeric = Number(value ?? 0);
  if (Number.isNaN(numeric)) return 0;
  return Math.max(0, Math.min(1, numeric));
}

export function scoreRelationshipPaths(paths: RelationshipPath[]) {
  if (paths.length === 0) {
    return {
      warmPathExists: false,
      relationshipPathScore: 0,
      bestRelationshipStrategy: "cold_outreach",
    };
  }

  const best = [...paths].sort((left, right) => {
    const leftScore = Number(left.isWarm) * 50 + parseConfidence(left.confidenceScore) * 50;
    const rightScore = Number(right.isWarm) * 50 + parseConfidence(right.confidenceScore) * 50;
    return rightScore - leftScore;
  })[0]!;

  const score = Math.round(Number(best.isWarm) * 50 + parseConfidence(best.confidenceScore) * 50);
  const confidence = parseConfidence(best.confidenceScore);
  const bestRelationshipStrategy = best.isWarm
    ? confidence >= 0.75
      ? "relationship_first"
      : "warm_intro"
    : confidence >= 0.5
      ? "networked_outreach"
      : "cold_outreach";

  return {
    warmPathExists: paths.some((path) => path.isWarm),
    relationshipPathScore: score,
    bestRelationshipStrategy,
  };
}
