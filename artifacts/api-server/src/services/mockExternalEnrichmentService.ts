import { GeoNamesMockService, type GeonameResult, resolveCountryCode } from "./geonamesMockService";

export interface MockBusiness {
  id?: number | string;
  name: string;
  city?: string | null;
  country?: string | null;
  targetMarket?: string | null;
  website?: string | null;
  phone?: string | null;
  osmId?: string | null;
  wikidataId?: string | null;
  geonamesId?: string | null;
  dataQualityScore?: number | null;
  sourceRecords?: MockSourceRecord[];
}

export interface MockSourceRecord {
  sourceType: string;
  sourceUrl: string;
  sourceLicense: string;
  sourceAttribution: string;
  sourceRateLimitBucket: string;
  sourcePayloadSummary: string;
}

export interface MockEnrichmentResult {
  status: "enriched" | "miss" | "skipped";
  business: MockBusiness & {
    geonamesId?: string | null;
    dataQualityScore: number;
  };
  sourceRecord: MockSourceRecord | null;
  match: GeonameResult | null;
  qualityBefore: number;
  qualityAfter: number;
}

export interface MockEnrichmentStats {
  total: number;
  matched: number;
  missed: number;
  skipped: number;
  averageQualityBefore: number;
  averageQualityAfter: number;
}

export function calculateMockDataQualityScore(business: MockBusiness, sourceCount = 0): number {
  let score = 0;
  if (business.website) score += 20;
  if (business.phone) score += 15;
  if (business.osmId) score += 15;
  if (business.wikidataId) score += 20;
  if (business.geonamesId) score += 10;
  if (sourceCount >= 2) score += 10;
  return Math.min(100, score);
}

export function deriveCountryCode(business: Pick<MockBusiness, "country" | "targetMarket">): string | null {
  return resolveCountryCode(business.country) ?? resolveCountryCode(business.targetMarket);
}

export async function enrichMockBusinessWithGeoNames(
  business: MockBusiness,
  service: GeoNamesMockService,
): Promise<MockEnrichmentResult> {
  const existingSources = business.sourceRecords ?? [];
  const qualityBefore = calculateMockDataQualityScore(business, existingSources.length);

  if (!business.city) {
    return {
      status: "skipped",
      business: { ...business, dataQualityScore: qualityBefore },
      sourceRecord: null,
      match: null,
      qualityBefore,
      qualityAfter: qualityBefore,
    };
  }

  const countryCode = deriveCountryCode(business);
  const match = await service.lookup(business.city, countryCode ?? undefined);

  if (!match) {
    return {
      status: "miss",
      business: { ...business, dataQualityScore: qualityBefore },
      sourceRecord: null,
      match: null,
      qualityBefore,
      qualityAfter: qualityBefore,
    };
  }

  const sourceRecord = buildGeoNamesSourceRecord(match);
  const sourceRecords = upsertMockSource(existingSources, sourceRecord);
  const enrichedBusiness = {
    ...business,
    geonamesId: match.geonameId,
    sourceRecords,
  };
  const qualityAfter = calculateMockDataQualityScore(enrichedBusiness, sourceRecords.length);

  return {
    status: "enriched",
    business: {
      ...enrichedBusiness,
      dataQualityScore: qualityAfter,
    },
    sourceRecord,
    match,
    qualityBefore,
    qualityAfter,
  };
}

export async function enrichMockBusinessesWithGeoNames(
  businesses: MockBusiness[],
  service: GeoNamesMockService,
): Promise<{ results: MockEnrichmentResult[]; stats: MockEnrichmentStats }> {
  const results: MockEnrichmentResult[] = [];

  for (const business of businesses) {
    results.push(await enrichMockBusinessWithGeoNames(business, service));
  }

  return {
    results,
    stats: summarizeMockResults(results),
  };
}

function buildGeoNamesSourceRecord(match: GeonameResult): MockSourceRecord {
  return {
    sourceType: "geonames_record",
    sourceUrl: `https://www.geonames.org/${match.geonameId}`,
    sourceLicense: "CC BY 4.0",
    sourceAttribution: "GeoNames",
    sourceRateLimitBucket: "local_dump",
    sourcePayloadSummary: [
      `city=${match.asciiName}`,
      `country_code=${match.countryCode}`,
      `population=${match.population}`,
      match.timezone ? `timezone=${match.timezone}` : null,
    ]
      .filter(Boolean)
      .join("; "),
  };
}

function upsertMockSource(existingSources: MockSourceRecord[], sourceRecord: MockSourceRecord): MockSourceRecord[] {
  const byKey = new Map(existingSources.map((source) => [`${source.sourceType}::${source.sourceUrl}`, source]));
  byKey.set(`${sourceRecord.sourceType}::${sourceRecord.sourceUrl}`, sourceRecord);
  return Array.from(byKey.values());
}

function summarizeMockResults(results: MockEnrichmentResult[]): MockEnrichmentStats {
  const total = results.length;
  const matched = results.filter((result) => result.status === "enriched").length;
  const missed = results.filter((result) => result.status === "miss").length;
  const skipped = results.filter((result) => result.status === "skipped").length;

  return {
    total,
    matched,
    missed,
    skipped,
    averageQualityBefore: average(results.map((result) => result.qualityBefore)),
    averageQualityAfter: average(results.map((result) => result.qualityAfter)),
  };
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}
