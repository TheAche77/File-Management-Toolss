import { logger } from "../lib/logger";
import { scheduleDueResearchWork } from "./freshnessSchedulerService";
import { runResearchTick } from "./researchJobService";

let automationHandle: NodeJS.Timeout | null = null;
let automationRunning = false;

export async function runResearchAutomationTick() {
  if (automationRunning) return;
  automationRunning = true;

  try {
    const scheduled = await scheduleDueResearchWork();
    await runResearchTick();
    logger.info({ scheduled }, "Research automation tick completed");
  } catch (error) {
    logger.error({ err: error }, "Research automation tick failed");
  } finally {
    automationRunning = false;
  }
}

export function startResearchAutomationLoop(intervalMs = 30_000) {
  if (automationHandle) return;

  queueMicrotask(() => {
    void runResearchAutomationTick();
  });

  automationHandle = setInterval(() => {
    void runResearchAutomationTick();
  }, intervalMs);
}

export function stopResearchAutomationLoop() {
  if (automationHandle) clearInterval(automationHandle);
  automationHandle = null;
}
