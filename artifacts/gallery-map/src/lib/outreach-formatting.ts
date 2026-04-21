export function formatPipelineValue(value?: string | null) {
  if (!value) return "Not set";

  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatDueLabel(daysUntilAction?: number | null, nextActionDate?: string | null) {
  if (daysUntilAction === null || daysUntilAction === undefined) {
    return "No action scheduled";
  }

  if (daysUntilAction < 0) {
    return `Scaduto da ${Math.abs(daysUntilAction)} giorno${Math.abs(daysUntilAction) === 1 ? "" : "i"}`;
  }

  if (daysUntilAction === 0) return "Oggi";
  if (daysUntilAction === 1) return "Domani";

  return nextActionDate ?? `+${daysUntilAction} giorni`;
}
