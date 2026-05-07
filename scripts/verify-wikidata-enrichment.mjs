import { spawnSync } from "node:child_process";
import process from "node:process";
import pg from "pg";
import { checkWikidataEndpoint } from "./check-wikidata-endpoint.mjs";

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/scopri_italia";
const SLG_USER_AGENT =
  process.env.SLG_USER_AGENT ??
  "StreetLevelDiscovery/1.0 (https://github.com/TheAche77/File-Management-Toolss)";
const TEST_BUSINESS = {
  categorySlug: "cultural_institute",
  name: "Colosseum",
  slug: "test-colosseum-wikidata",
  latitude: "41.8902000",
  longitude: "12.4922000",
  city: "Roma",
  country: "Italy",
};

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL,
      SLG_USER_AGENT,
      ...options.env,
    },
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
  }
}

async function query(client, text, params = []) {
  const result = await client.query(text, params);
  return result.rows;
}

async function ensureBusiness(client) {
  const existing = await query(
    client,
    `
      SELECT id
      FROM businesses
      WHERE enrichment_status IN ('pending', 'partially_enriched')
      ORDER BY
        CASE
          WHEN category_slug IN ('cultural_institute', 'art_museum', 'museum', 'urban_art_gallery') THEN 0
          ELSE 1
        END,
        id
      LIMIT 1
    `,
  );

  if (existing[0]?.id) return Number(existing[0].id);

  return ensureDeterministicBusiness(client);
}

async function ensureDeterministicBusiness(client) {
  const inserted = await query(
    client,
    `
      INSERT INTO businesses (
        category_slug,
        name,
        slug,
        latitude,
        longitude,
        city,
        country,
        has_website,
        has_phone,
        enrichment_status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, false, false, 'pending')
      ON CONFLICT (category_slug, slug) DO UPDATE
      SET
        enrichment_status = 'pending',
        wikidata_id = NULL,
        data_quality_score = NULL,
        enrichment_source_count = NULL,
        last_enrichment_at = NULL,
        updated_at = now()
      RETURNING id
    `,
    [
      TEST_BUSINESS.categorySlug,
      TEST_BUSINESS.name,
      TEST_BUSINESS.slug,
      TEST_BUSINESS.latitude,
      TEST_BUSINESS.longitude,
      TEST_BUSINESS.city,
      TEST_BUSINESS.country,
    ],
  );

  if (!inserted[0]?.id) {
    throw new Error("Could not select or insert a Wikidata verification business.");
  }
  return Number(inserted[0].id);
}

async function getBusinessSnapshot(client, businessId) {
  const rows = await query(
    client,
    `
      SELECT
        id,
        name,
        wikidata_id,
        geonames_id,
        enrichment_status,
        data_quality_score,
        enrichment_source_count,
        last_enrichment_at
      FROM businesses
      WHERE id = $1
      LIMIT 1
    `,
    [businessId],
  );

  const business = rows[0];
  if (!business) throw new Error(`Business ${businessId} not found after enrichment.`);
  return business;
}

async function getWikidataSources(client, businessId) {
  return query(
    client,
    `
      SELECT
        id,
        source_url,
        fetch_status,
        source_license,
        source_attribution,
        source_payload_summary,
        source_rate_limit_bucket,
        last_fetched_at
      FROM business_sources
      WHERE business_id = $1
        AND source_type = 'wikidata_entity'
      ORDER BY id
    `,
    [businessId],
  );
}

function assertNoDuplicateSources(sources) {
  const seen = new Set();
  const duplicates = [];
  for (const source of sources) {
    if (seen.has(source.source_url)) duplicates.push(source.source_url);
    seen.add(source.source_url);
  }
  if (duplicates.length > 0) {
    throw new Error(`Duplicate wikidata_entity sources found: ${duplicates.join(", ")}`);
  }
}

async function main() {
  console.log("[wikidata-verify] Running Drizzle migrations...");
  run("pnpm", ["--filter", "@workspace/db", "run", "migrate"]);

  console.log("[wikidata-verify] Checking Wikidata endpoint availability...");
  const endpoint = await checkWikidataEndpoint({ userAgent: SLG_USER_AGENT });
  if (!endpoint.ok) {
    console.error("[wikidata-verify] WIKIDATA_UPSTREAM_UNAVAILABLE");
    console.error(
      JSON.stringify(
        {
          status: endpoint.status,
          durationMs: endpoint.durationMs,
          error: endpoint.error,
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
    return;
  }
  console.log(
    `[wikidata-verify] Wikidata endpoint reachable in ${endpoint.durationMs}ms with status ${endpoint.status}.`,
  );

  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();

  try {
    const businessId = await ensureBusiness(client);
    console.log(`[wikidata-verify] Using business id ${businessId}`);

    const verification = await runVerificationForBusiness(client, businessId, false);
    if (!verification.business.wikidata_id) {
      console.log(
        "[wikidata-verify] First business did not receive wikidata_id; verifying deterministic Colosseum fixture.",
      );
      const deterministicBusinessId = await ensureDeterministicBusiness(client);
      await runVerificationForBusiness(client, deterministicBusinessId, true);
    }

    console.log("[wikidata-verify] Verification passed.");
  } finally {
    await client.end();
  }
}

async function runVerificationForBusiness(client, businessId, requireWikidataId) {
    console.log("[wikidata-verify] First enrichment run...");
    run("pnpm", ["run", "enrich:business", "--", "--id", String(businessId)]);

    const firstSnapshot = await getBusinessSnapshot(client, businessId);
    const firstSources = await getWikidataSources(client, businessId);
    console.log("[wikidata-verify] First snapshot:");
    console.log(JSON.stringify({ business: firstSnapshot, sources: firstSources }, null, 2));

    if (!firstSnapshot.last_enrichment_at) {
      throw new Error("last_enrichment_at remained null after first enrichment run.");
    }
    if (firstSnapshot.data_quality_score === null || firstSnapshot.data_quality_score === undefined) {
      throw new Error("data_quality_score remained null after first enrichment run.");
    }
    assertNoDuplicateSources(firstSources);

    console.log("[wikidata-verify] Second enrichment run...");
    run("pnpm", ["run", "enrich:business", "--", "--id", String(businessId)]);

    const secondSnapshot = await getBusinessSnapshot(client, businessId);
    const secondSources = await getWikidataSources(client, businessId);
    console.log("[wikidata-verify] Second snapshot:");
    console.log(JSON.stringify({ business: secondSnapshot, sources: secondSources }, null, 2));

    if (!secondSnapshot.last_enrichment_at) {
      throw new Error("last_enrichment_at remained null after second enrichment run.");
    }
    if (secondSnapshot.data_quality_score === null || secondSnapshot.data_quality_score === undefined) {
      throw new Error("data_quality_score remained null after second enrichment run.");
    }
    assertNoDuplicateSources(secondSources);

    if (requireWikidataId && !secondSnapshot.wikidata_id) {
      throw new Error("Deterministic Colosseum verification business did not receive a wikidata_id.");
    }

    return { business: secondSnapshot, sources: secondSources };
  }

main().catch((err) => {
  console.error("[wikidata-verify] Verification failed.");
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
