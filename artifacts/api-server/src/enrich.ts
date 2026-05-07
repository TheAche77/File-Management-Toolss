import { pool } from "@workspace/db";
import { runExternalEnrichment } from "./services/externalEnrichmentService";
import { logger } from "./lib/logger";

function getArgValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function parseLimit(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

async function main() {
  const mode = process.argv[2] ?? "pending";
  const source = getArgValue("--source") ?? (mode === "source" ? "wikidata" : undefined);
  const businessId = parseLimit(getArgValue("--id"));
  const limit = parseLimit(getArgValue("--limit"));

  if (mode !== "pending" && mode !== "business" && mode !== "source") {
    throw new Error(`Unsupported enrichment mode "${mode}". Use pending, business, or source.`);
  }

  if (mode === "business" && !businessId) {
    throw new Error("enrich:business requires --id <businessId>");
  }

  const stats = await runExternalEnrichment({
    source,
    limit,
    businessId: mode === "business" ? businessId : undefined,
  });

  logger.info({ stats }, "External enrichment finished");
  process.stdout.write(`${JSON.stringify({ success: true, stats }, null, 2)}\n`);
}

main()
  .catch((err) => {
    logger.error({ err }, "External enrichment failed");
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
