#!/usr/bin/env node

const API_BASE_URL = (process.env.API_BASE_URL ?? "http://localhost:8080/api").replace(/\/$/, "");

const failures = [];

function recordFailure(label, message) {
  failures.push(`${label}: ${message}`);
}

async function request(path, options = {}) {
  const headers = {
    ...(options.headers ?? {}),
  };
  return fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
  });
}

async function expectStatus(label, path, expectedStatus, options = {}) {
  try {
    const response = await request(path, options);
    if (Array.isArray(expectedStatus) ? !expectedStatus.includes(response.status) : response.status !== expectedStatus) {
      recordFailure(label, `expected ${expectedStatus}, got ${response.status}`);
    }
    return response;
  } catch (error) {
    recordFailure(label, error instanceof Error ? error.message : String(error));
    return null;
  }
}

async function expectJson(label, path, options = {}) {
  const response = await expectStatus(label, path, 200, options);
  if (!response) return null;
  try {
    return await response.json();
  } catch (error) {
    recordFailure(label, `invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

async function expectCsv(label, path, options = {}) {
  const response = await expectStatus(label, path, 200, options);
  if (!response) return;
  const contentType = response.headers.get("content-type") ?? "";
  const body = await response.text();
  if (!contentType.includes("text/csv")) {
    recordFailure(label, `expected text/csv content-type, got "${contentType}"`);
  }
  if (!body.trim()) {
    recordFailure(label, "CSV body is empty");
  }
  if (!body.includes(",")) {
    recordFailure(label, "CSV body does not look comma-delimited");
  }
}

function expectArray(label, value) {
  if (!Array.isArray(value)) {
    recordFailure(label, "expected JSON array");
    return [];
  }
  return value;
}

function expectObject(label, value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    recordFailure(label, "expected JSON object");
    return {};
  }
  return value;
}

function expectSlugs(label, rows, expectedSlugs) {
  const slugs = new Set(rows.map((row) => row?.slug).filter(Boolean));
  for (const slug of expectedSlugs) {
    if (!slugs.has(slug)) {
      recordFailure(label, `missing default slug "${slug}"`);
    }
  }
}

await expectStatus("health", "/healthz", 200);

const publicJsonEndpoints = [
  ["/businesses", "businesses list"],
  ["/businesses?page=1&pageSize=10", "businesses paginated"],
  ["/businesses?engineType=revenue", "businesses engine filter"],
  ["/businesses?targetCluster=hospitality", "businesses cluster filter"],
  ["/businesses?prestigeWatchlist=true", "businesses prestige filter"],
  ["/businesses?cultivationRequired=true", "businesses cultivation filter"],
];

for (const [path, label] of publicJsonEndpoints) {
  expectObject(label, await expectJson(label, path));
}

const operationalJsonEndpoints = [
  ["/research/metrics", "research metrics"],
  ["/research/feed", "research feed"],
  ["/research/feed?targetType=buyer&warmPathExists=true", "research feed advanced filters"],
  ["/research/review-buckets", "research review buckets"],
  ["/research/jobs", "research jobs"],
  ["/slg/relationship-paths", "slg relationship paths"],
  ["/slg/strategic-accounts", "slg strategic accounts"],
];

for (const [path, label] of operationalJsonEndpoints) {
  const json = await expectJson(label, path);
  if (path.includes("feed") || path.includes("metrics")) {
    expectObject(label, json);
  } else {
    expectArray(label, json);
  }
}

await expectStatus("run research jobs", "/research/jobs/run", 200, { method: "POST" });

const offers = expectArray("slg offers", await expectJson("slg offers", "/slg/offers"));
expectSlugs("slg offers", offers, [
  "exhibition-partnership",
  "urban-art-commission",
  "curatorial-partnership",
  "labirinto-residency-program",
  "festival-public-activation",
  "collector-corporate-advisory",
  "educational-workshop-program",
  "brand-culture-collaboration",
]);

const narratives = expectArray("slg narratives", await expectJson("slg narratives", "/slg/narratives"));
expectSlugs("slg narratives", narratives, [
  "urban-art-authority",
  "tuscany-uniqueness",
  "institutional-bridge",
  "cultural-impact-social-value",
  "living-artist-ecosystem",
  "florence-strategic-node",
  "labirinto-platform",
]);

const contentAssets = expectArray("slg content assets", await expectJson("slg content assets", "/slg/content-assets"));
expectSlugs("slg content assets", contentAssets, [
  "hospitality-pitch-snippet",
  "institutional-pitch-snippet",
  "authority-proof-snippet",
  "revenue-cta-suggestion",
  "institutional-cta-suggestion",
  "authority-cta-suggestion",
]);

const seasonalWindows = expectArray("slg seasonal windows", await expectJson("slg seasonal windows", "/slg/seasonal-windows"));
expectSlugs("slg seasonal windows", seasonalWindows, [
  "hospitality-q1-q3",
  "institutional-q1-q4",
  "festival-spring-summer",
  "grants-foundations-q3-q4",
  "fairs-collector-q3",
  "schools-universities-q2-q3",
]);

for (const [path, label] of [
  ["/slg/credibility-assets", "slg credibility assets"],
  ["/slg/case-studies", "slg case studies"],
  ["/offers", "legacy offers"],
  ["/narratives", "legacy narratives"],
  ["/credibility-assets", "legacy credibility assets"],
  ["/case-studies", "legacy case studies"],
]) {
  expectArray(label, await expectJson(label, path));
}

await expectCsv("businesses csv", "/export/businesses.csv");
for (const [path, label] of [
  ["/export/business-research-summary.csv", "business research summary csv"],
  ["/export/outreach-ready.csv", "outreach ready csv"],
  ["/export/review-queue.csv", "review queue csv"],
  ["/export/slg-revenue-targets.csv", "slg revenue csv"],
  ["/export/slg-institutional-targets.csv", "slg institutional csv"],
  ["/export/slg-authority-targets.csv", "slg authority csv"],
  ["/export/slg-referral-paths.csv", "slg referral csv"],
  ["/export/slg-labirinto-fit.csv", "slg labirinto csv"],
  ["/export/slg-hospitality-targets.csv", "slg hospitality csv"],
]) {
  await expectCsv(label, path);
}

if (failures.length > 0) {
  console.error(`SLG runtime smoke failed with ${failures.length} failure(s):`);
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`SLG runtime smoke passed against ${API_BASE_URL}`);
