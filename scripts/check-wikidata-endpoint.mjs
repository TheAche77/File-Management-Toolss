import process from "node:process";

const WIKIDATA_SPARQL_URL = "https://query.wikidata.org/sparql";
const DEFAULT_USER_AGENT =
  "StreetLevelDiscovery/1.0 (https://github.com/TheAche77/File-Management-Toolss)";
const DEFAULT_TIMEOUT_MS = 15_000;
const QUERY = `
SELECT ?item ?itemLabel WHERE {
  BIND(wd:Q10285 AS ?item)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT 1`;

export async function checkWikidataEndpoint(options = {}) {
  const userAgent = options.userAgent ?? process.env["SLG_USER_AGENT"] ?? DEFAULT_USER_AGENT;
  const timeoutMs = Number.parseInt(
    String(options.timeoutMs ?? process.env["WIKIDATA_REQUEST_TIMEOUT_MS"] ?? DEFAULT_TIMEOUT_MS),
    10,
  );
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number.isFinite(timeoutMs) ? timeoutMs : DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(WIKIDATA_SPARQL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/sparql-query",
        "Accept": "application/sparql-results+json",
        "User-Agent": userAgent,
        "Api-User-Agent": userAgent,
      },
      body: QUERY,
      signal: controller.signal,
    });
    const durationMs = Date.now() - startedAt;

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        durationMs,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const data = await response.json();
    const bindings = data?.results?.bindings;
    const hasResult = Array.isArray(bindings) && bindings.length > 0;

    return {
      ok: hasResult,
      status: response.status,
      durationMs,
      error: hasResult ? null : "Valid SPARQL JSON returned no bindings.",
    };
  } catch (err) {
    return {
      ok: false,
      status: null,
      durationMs: Date.now() - startedAt,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  const result = await checkWikidataEndpoint();
  console.log(
    JSON.stringify(
      {
        endpoint: WIKIDATA_SPARQL_URL,
        reachable: result.ok,
        status: result.status,
        durationMs: result.durationMs,
        error: result.error,
      },
      null,
      2,
    ),
  );

  if (!result.ok) {
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}
