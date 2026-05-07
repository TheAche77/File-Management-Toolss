import { createReadStream } from "node:fs";
import { access } from "node:fs/promises";
import { createInterface } from "node:readline";

export interface GeonameResult {
  geonameId: string;
  name: string;
  asciiName: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  population: number;
  timezone: string | null;
}

export interface GeoNamesMockServiceOptions {
  filePath?: string;
}

interface IndexedGeoname extends GeonameResult {
  isAlternateName: boolean;
}

const DEFAULT_FILE_PATH = "data/cities15000.txt";

const COUNTRY_CODE_BY_NAME_OR_MARKET: Record<string, string> = {
  austria: "AT",
  at: "AT",
  belgium: "BE",
  be: "BE",
  france: "FR",
  fr: "FR",
  germany: "DE",
  de: "DE",
  italy: "IT",
  it: "IT",
  netherlands: "NL",
  nl: "NL",
  portugal: "PT",
  pt: "PT",
  spain: "ES",
  es: "ES",
  "united kingdom": "GB",
  uk: "GB",
  gb: "GB",
  "united states": "US",
  usa: "US",
  us: "US",
};

export function normalizeGeoNameKey(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function resolveCountryCode(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = normalizeGeoNameKey(value);
  return COUNTRY_CODE_BY_NAME_OR_MARKET[normalized] ?? null;
}

function buildCountryKey(city: string, countryCode: string): string {
  return `${normalizeGeoNameKey(city)}|${countryCode.toUpperCase()}`;
}

function parseNumber(value: string | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function shouldReplace(existing: IndexedGeoname | undefined, incoming: IndexedGeoname): boolean {
  if (!existing) return true;
  if (existing.isAlternateName && !incoming.isAlternateName) return true;
  if (!existing.isAlternateName && incoming.isAlternateName) return false;
  return incoming.population > existing.population;
}

function parseGeoNamesRow(line: string): {
  result: GeonameResult;
  alternateNames: string[];
} | null {
  const columns = line.split("\t");
  if (columns.length < 19) return null;

  const geonameId = columns[0];
  const name = columns[1];
  const asciiName = columns[2];
  const alternateNames = columns[3];
  const latitude = parseNumber(columns[4]);
  const longitude = parseNumber(columns[5]);
  const countryCode = columns[8];
  const population = parseNumber(columns[14]);
  const timezone = columns[17] || null;

  if (!geonameId || !name || !asciiName || !countryCode) return null;

  return {
    result: {
      geonameId,
      name,
      asciiName,
      countryCode: countryCode.toUpperCase(),
      latitude,
      longitude,
      population,
      timezone,
    },
    alternateNames: alternateNames ? alternateNames.split(",").filter(Boolean) : [],
  };
}

export class GeoNamesMockService {
  private readonly filePath: string;
  private readonly byCityCountry = new Map<string, IndexedGeoname>();
  private readonly byCity = new Map<string, IndexedGeoname>();
  private loaded = false;
  private totalRows = 0;

  constructor(options: GeoNamesMockServiceOptions = {}) {
    this.filePath = options.filePath ?? DEFAULT_FILE_PATH;
  }

  async load(): Promise<void> {
    if (this.loaded) return;

    await access(this.filePath);

    const reader = createInterface({
      input: createReadStream(this.filePath, { encoding: "utf8" }),
      crlfDelay: Infinity,
    });

    for await (const line of reader) {
      if (!line.trim()) continue;
      const parsed = parseGeoNamesRow(line);
      if (!parsed) continue;
      this.totalRows += 1;
      this.indexResult(parsed.result, false);

      for (const alternateName of parsed.alternateNames) {
        this.indexName(alternateName, parsed.result, true);
      }
    }

    this.loaded = true;
  }

  async lookup(city: string, countryCode?: string): Promise<GeonameResult | null> {
    await this.load();

    const normalizedCountryCode = countryCode ? resolveCountryCode(countryCode) ?? countryCode.toUpperCase() : null;
    if (normalizedCountryCode) {
      const exact = this.byCityCountry.get(buildCountryKey(city, normalizedCountryCode));
      return exact ? toResult(exact) : null;
    }

    const cityOnly = this.byCity.get(normalizeGeoNameKey(city));
    return cityOnly ? toResult(cityOnly) : null;
  }

  getStats(): { loaded: boolean; totalRows: number; indexedKeys: number } {
    return {
      loaded: this.loaded,
      totalRows: this.totalRows,
      indexedKeys: this.byCityCountry.size,
    };
  }

  private indexResult(result: GeonameResult, isAlternateName: boolean): void {
    this.indexName(result.name, result, isAlternateName);
    this.indexName(result.asciiName, result, isAlternateName);
  }

  private indexName(name: string, result: GeonameResult, isAlternateName: boolean): void {
    const normalized = normalizeGeoNameKey(name);
    if (!normalized) return;

    const indexed: IndexedGeoname = { ...result, isAlternateName };
    const countryKey = `${normalized}|${result.countryCode}`;
    if (shouldReplace(this.byCityCountry.get(countryKey), indexed)) {
      this.byCityCountry.set(countryKey, indexed);
    }

    if (shouldReplace(this.byCity.get(normalized), indexed)) {
      this.byCity.set(normalized, indexed);
    }
  }
}

function toResult(indexed: IndexedGeoname): GeonameResult {
  const { isAlternateName: _isAlternateName, ...result } = indexed;
  return result;
}
