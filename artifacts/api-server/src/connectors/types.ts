import type { InsertBusiness } from "@workspace/db";
import type { Business, InsertBusinessSource } from "@workspace/db";

export interface ConnectorResult {
  items: InsertBusiness[];
  source: string;
  errors: string[];
}

export interface ConnectorOptions {
  categorySlug: string;
  city: string;
  osmTags: string;
  bbox?: BoundingBox;
}

export interface BoundingBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface CityDiscoveryConfig {
  bbox: BoundingBox;
  canonicalName: string;
  country: string;
  targetMarket: string;
}

export interface Connector {
  name: string;
  isAvailable(): boolean;
  fetch(options: ConnectorOptions): Promise<ConnectorResult>;
}

export interface EnrichmentSourceDecision {
  source: string;
  decision: "implement_now" | "disabled_by_config" | "document_only" | "rejected_for_now";
  reason: string;
  documentationUrl: string;
}

export interface EnrichmentConnectorResult {
  businessId: number;
  source: string;
  status: "enriched" | "unchanged" | "miss" | "failed" | "skipped";
  patch: Partial<InsertBusiness>;
  sourceRecords: InsertBusinessSource[];
  errors: string[];
  sourceHash?: string | null;
  latencyMs: number;
}

export interface EnrichmentConnector {
  name: string;
  isAvailable(): boolean;
  getRateLimitMetadata(): {
    bucket: string;
    maxRequests: number;
    intervalMs: number;
    concurrency: number;
  };
  enrichBusiness(business: Business): Promise<EnrichmentConnectorResult>;
}

export const CITY_DISCOVERY_CONFIGS: Record<string, CityDiscoveryConfig> = {
  rome: {
    bbox: { south: 41.8, west: 12.3, north: 42.0, east: 12.6 },
    canonicalName: "Roma",
    country: "Italy",
    targetMarket: "IT",
  },
  milan: {
    bbox: { south: 45.4, west: 9.1, north: 45.5, east: 9.3 },
    canonicalName: "Milano",
    country: "Italy",
    targetMarket: "IT",
  },
  florence: {
    bbox: { south: 43.7, west: 11.2, north: 43.8, east: 11.3 },
    canonicalName: "Firenze",
    country: "Italy",
    targetMarket: "IT",
  },
  naples: {
    bbox: { south: 40.8, west: 14.2, north: 40.9, east: 14.3 },
    canonicalName: "Napoli",
    country: "Italy",
    targetMarket: "IT",
  },
  venice: {
    bbox: { south: 45.4, west: 12.3, north: 45.5, east: 12.4 },
    canonicalName: "Venezia",
    country: "Italy",
    targetMarket: "IT",
  },
  london: {
    bbox: { south: 51.45, west: -0.2, north: 51.55, east: 0.0 },
    canonicalName: "London",
    country: "United Kingdom",
    targetMarket: "UK",
  },
  amsterdam: {
    bbox: { south: 52.34, west: 4.85, north: 52.42, east: 5.0 },
    canonicalName: "Amsterdam",
    country: "Netherlands",
    targetMarket: "NL",
  },
  paris: {
    bbox: { south: 48.82, west: 2.28, north: 48.9, east: 2.42 },
    canonicalName: "Paris",
    country: "France",
    targetMarket: "FR",
  },
  barcelona: {
    bbox: { south: 41.35, west: 2.1, north: 41.44, east: 2.22 },
    canonicalName: "Barcelona",
    country: "Spain",
    targetMarket: "ES",
  },
  madrid: {
    bbox: { south: 40.36, west: -3.76, north: 40.48, east: -3.62 },
    canonicalName: "Madrid",
    country: "Spain",
    targetMarket: "ES",
  },
  lisbon: {
    bbox: { south: 38.68, west: -9.24, north: 38.78, east: -9.08 },
    canonicalName: "Lisbon",
    country: "Portugal",
    targetMarket: "PT",
  },
  berlin: {
    bbox: { south: 52.45, west: 13.28, north: 52.56, east: 13.5 },
    canonicalName: "Berlin",
    country: "Germany",
    targetMarket: "DE",
  },
  rotterdam: {
    bbox: { south: 51.86, west: 4.37, north: 51.97, east: 4.56 },
    canonicalName: "Rotterdam",
    country: "Netherlands",
    targetMarket: "NL",
  },
  brussels: {
    bbox: { south: 50.8, west: 4.28, north: 50.9, east: 4.43 },
    canonicalName: "Brussels",
    country: "Belgium",
    targetMarket: "BE",
  },
  vienna: {
    bbox: { south: 48.16, west: 16.28, north: 48.25, east: 16.43 },
    canonicalName: "Vienna",
    country: "Austria",
    targetMarket: "AT",
  },
  "new-york": {
    bbox: { south: 40.68, west: -74.03, north: 40.8, east: -73.93 },
    canonicalName: "New York",
    country: "United States",
    targetMarket: "USA",
  },
};

const CITY_ALIASES: Record<string, string> = {
  roma: "rome",
  milano: "milan",
  firenze: "florence",
  venezia: "venice",
  "new york": "new-york",
  nyc: "new-york",
  lisboa: "lisbon",
  bruxelles: "brussels",
  brussel: "brussels",
  wien: "vienna",
};

export const CITY_BBOXES: Record<string, BoundingBox> = Object.fromEntries(
  Object.entries(CITY_DISCOVERY_CONFIGS).map(([key, config]) => [key, config.bbox]),
);

function normalizeCityKey(city: string): string {
  const key = city.toLowerCase().trim();
  return CITY_ALIASES[key] ?? key.replace(/\s+/g, "-");
}

export function resolveCityDiscoveryConfig(city: string): CityDiscoveryConfig {
  const key = normalizeCityKey(city);
  const config = CITY_DISCOVERY_CONFIGS[key];
  if (!config) {
    throw new Error(
      `Unsupported discovery city "${city}". Add it to CITY_DISCOVERY_CONFIGS or pass an explicit bbox.`,
    );
  }
  return config;
}

export function resolveBbox(city: string): BoundingBox {
  return resolveCityDiscoveryConfig(city).bbox;
}

export function resolveCityCountry(city: string): string | null {
  try {
    return resolveCityDiscoveryConfig(city).country;
  } catch {
    return null;
  }
}

export function resolveCityTargetMarket(city: string): string | null {
  try {
    return resolveCityDiscoveryConfig(city).targetMarket;
  } catch {
    return null;
  }
}
