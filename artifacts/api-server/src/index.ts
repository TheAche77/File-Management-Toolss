import app from "./app";
import { logger } from "./lib/logger";
import { validateServerEnv } from "./lib/env";
import { resumePendingImportRuns } from "./services/importJobService";
import { startResearchAutomationLoop } from "./services/researchAutomationService";

const env = validateServerEnv();
const port = env.port;

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  void resumePendingImportRuns();
  startResearchAutomationLoop();
});
