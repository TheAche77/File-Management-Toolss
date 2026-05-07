import { existsSync, readFileSync } from "node:fs";
import { GeoNamesMockService } from "./services/geonamesMockService";
import {
  deriveCountryCode,
  enrichMockBusinessesWithGeoNames,
  type MockBusiness,
} from "./services/mockExternalEnrichmentService";

const DEFAULT_GEONAMES_FILE = "data/cities15000.txt";
const DEFAULT_LIMIT = 100;
const BUILT_IN_BUSINESSES: MockBusiness[] = [
  { id: "mock-roma", name: "SLG Roma sample", city: "Roma", country: "Italy", targetMarket: "IT", osmId: "mock-1" },
  { id: "mock-london", name: "London gallery sample", city: "London", country: "United Kingdom", targetMarket: "UK" },
  { id: "mock-paris", name: "Paris culture sample", city: "Paris", country: "France", targetMarket: "FR", website: "https://example.org" },
  { id: "mock-amsterdam", name: "Amsterdam museum sample", city: "Amsterdam", country: "Netherlands", targetMarket: "NL" },
  { id: "mock-barcelona", name: "Barcelona hotel sample", city: "Barcelona", country: "Spain", targetMarket: "ES", phone: "+34930000000" },
];

function getArgValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function parseLimit(value: string | undefined): number {
  if (!value) return DEFAULT_LIMIT;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.max(1, parsed) : DEFAULT_LIMIT;
}

function loadBusinesses(filePath: string | undefined, limit: number): MockBusiness[] {
  if (!filePath || !existsSync(filePath)) return BUILT_IN_BUSINESSES.slice(0, limit);

  const parsed = JSON.parse(readFileSync(filePath, "utf8")) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error(`Mock businesses file must contain a JSON array: ${filePath}`);
  }

  return parsed.slice(0, limit).map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw new Error(`Invalid mock business at index ${index}`);
    }
    const business = entry as Partial<MockBusiness>;
    if (!business.name) throw new Error(`Mock business at index ${index} is missing name`);
    return business as MockBusiness;
  });
}

function printMissingGeoNamesFile(filePath: string): void {
  console.error(`GeoNames dump not found: ${filePath}`);
  console.error("");
  console.error("Manual setup:");
  console.error("1. Download cities15000.zip from https://download.geonames.org/export/dump/");
  console.error("2. Extract cities15000.txt");
  console.error("3. Place it at data/cities15000.txt or pass --file <path>");
  console.error("");
  console.error("This mock does not call the GeoNames API and does not use Docker/Postgres.");
}

async function main() {
  const filePath = getArgValue("--file") ?? DEFAULT_GEONAMES_FILE;
  const businessesFile = getArgValue("--businesses");
  const limit = parseLimit(getArgValue("--limit"));

  if (!existsSync(filePath)) {
    printMissingGeoNamesFile(filePath);
    process.exitCode = 1;
    return;
  }

  const businesses = loadBusinesses(businessesFile, limit);
  const service = new GeoNamesMockService({ filePath });
  const { results, stats } = await enrichMockBusinessesWithGeoNames(businesses, service);
  const geoStats = service.getStats();

  for (const result of results) {
    const business = result.business;
    const countryCode = deriveCountryCode(business) ?? "any";
    const status = result.match ? "match" : result.status;
    console.log(
      [
        `[${status}]`,
        business.name,
        `city=${business.city ?? "n/a"}`,
        `country=${business.country ?? business.targetMarket ?? "n/a"}`,
        `countryCode=${countryCode}`,
        `geonameId=${business.geonamesId ?? "n/a"}`,
        `timezone=${result.match?.timezone ?? "n/a"}`,
        `quality=${result.qualityBefore}->${result.qualityAfter}`,
      ].join(" | "),
    );
  }

  console.log("");
  console.log("Mock enrichment summary:");
  console.log(JSON.stringify({ ...stats, geoNames: geoStats }, null, 2));
}

main().catch((err) => {
  console.error("Mock GeoNames enrichment failed.");
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
