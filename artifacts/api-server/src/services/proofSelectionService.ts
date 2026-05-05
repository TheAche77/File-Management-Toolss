import type { CaseStudy, CredibilityAsset } from "@workspace/db";
import type { SlgClassification } from "./slgClassificationService";

function splitCsv(value: string | null | undefined) {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function selectBestProof(
  classification: SlgClassification,
  credibilityAssets: CredibilityAsset[],
  caseStudies: CaseStudy[],
) {
  const assetWinner = credibilityAssets
    .filter((asset) => asset.active)
    .map((asset) => {
      let score = 0;
      if (splitCsv(asset.targetClusters).includes(classification.targetCluster)) score += 40;
      if (splitCsv(asset.engineTypes).includes(classification.engineType)) score += 20;
      if ((asset.tags ?? "").includes("international") && classification.engineType === "authority") score += 10;
      if ((asset.tags ?? "").includes("hospitality") && classification.targetCluster === "boutique_hotel_hospitality") score += 10;
      if ((asset.tags ?? "").includes("institutional") && classification.engineType === "institutional") score += 10;
      if ((asset.tags ?? "").includes("public") && classification.targetCluster === "public_cultural_institutions") score += 8;
      if ((asset.tags ?? "").includes("impact") && classification.targetCluster === "foundations_csr_philanthropy") score += 8;
      if ((asset.tags ?? "").includes("press") && classification.engineType === "authority") score += 8;
      if ((asset.tags ?? "").includes("museum") && classification.targetType === "prestige") score += 8;
      if ((asset.tags ?? "").includes("gallery") && classification.targetCluster === "commercial_collectors_ecosystem") score += 6;
      return { asset, score };
    })
    .sort((left, right) => right.score - left.score)[0];

  const caseStudyWinner = caseStudies
    .filter((caseStudy) => caseStudy.active)
    .map((caseStudy) => {
      let score = 0;
      if (caseStudy.targetCluster === classification.targetCluster) score += 40;
      if ((caseStudy.engineType ?? "") === classification.engineType) score += 20;
      if ((caseStudy.tags ?? "").includes("florence") && classification.targetCluster === "boutique_hotel_hospitality") score += 10;
      if ((caseStudy.tags ?? "").includes("festival") && classification.targetCluster === "festivals_placemaking") score += 10;
      if ((caseStudy.tags ?? "").includes("labirinto") && classification.targetCluster === "residency_exchange_diplomacy") score += 10;
      if ((caseStudy.tags ?? "").includes("gallery") && classification.targetCluster === "commercial_collectors_ecosystem") score += 8;
      return { caseStudy, score };
    })
    .sort((left, right) => right.score - left.score)[0];

  return {
    bestCredibilityAsset: assetWinner?.asset ?? null,
    bestCaseStudy: caseStudyWinner?.caseStudy ?? null,
    proofAngle: assetWinner?.asset?.summary ?? caseStudyWinner?.caseStudy?.summary ?? null,
    riskReductionReason:
      assetWinner?.asset?.name
        ? `Proof anchored in ${assetWinner.asset.name}`
        : caseStudyWinner?.caseStudy?.title
          ? `Proof anchored in ${caseStudyWinner.caseStudy.title}`
          : null,
  };
}
