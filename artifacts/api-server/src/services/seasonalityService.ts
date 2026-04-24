import type { SeasonalWindow } from "@workspace/db";
import type { SlgClassification } from "./slgClassificationService";

function isMonthInWindow(month: number, startMonth: number, endMonth: number) {
  if (startMonth <= endMonth) return month >= startMonth && month <= endMonth;
  return month >= startMonth || month <= endMonth;
}

export function getSeasonalityForClassification(
  classification: SlgClassification,
  seasonalWindows: SeasonalWindow[],
) {
  const month = new Date().getUTCMonth() + 1;
  const matching = seasonalWindows.filter((window) => {
    if (window.engineType && window.engineType !== classification.engineType) return false;
    if (window.targetCluster && window.targetCluster !== classification.targetCluster) return false;
    return true;
  });

  if (matching.length === 0) {
    return {
      seasonalityFit: "neutral",
      nextBestContactWindow: "always_on",
    };
  }

  const best = matching[0]!;
  const inWindow = isMonthInWindow(month, best.startMonth, best.endMonth);
  return {
    seasonalityFit: inWindow ? "high" : "medium",
    nextBestContactWindow: inWindow ? "current_window" : best.name,
  };
}
