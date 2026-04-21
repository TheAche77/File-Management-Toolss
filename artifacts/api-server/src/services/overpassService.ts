import { logger } from "../lib/logger";

export interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export interface OverpassResponse {
  elements: OverpassElement[];
}

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const TIMEOUT_MS = 30000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

const ROME_QUERY = `
[out:json][timeout:25];
(
  node["tourism"="gallery"](41.8,12.3,42.0,12.6);
  way["tourism"="gallery"](41.8,12.3,42.0,12.6);
  relation["tourism"="gallery"](41.8,12.3,42.0,12.6);
  node["shop"="art"](41.8,12.3,42.0,12.6);
  way["shop"="art"](41.8,12.3,42.0,12.6);
  relation["shop"="art"](41.8,12.3,42.0,12.6);
  node["amenity"="arts_centre"](41.8,12.3,42.0,12.6);
  way["amenity"="arts_centre"](41.8,12.3,42.0,12.6);
  relation["amenity"="arts_centre"](41.8,12.3,42.0,12.6);
);
out center;
`;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchRomeGalleries(): Promise<OverpassElement[]> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      logger.info({ attempt }, "Fetching Rome galleries from Overpass API");

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const response = await fetch(OVERPASS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "GallerieItalia/1.0 (art gallery mapper)",
          "Accept": "application/json",
        },
        body: `data=${encodeURIComponent(ROME_QUERY)}`,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(
          `Overpass API returned ${response.status}: ${response.statusText}`,
        );
      }

      const data = (await response.json()) as OverpassResponse;
      logger.info(
        { count: data.elements.length },
        "Overpass API fetch successful",
      );
      return data.elements;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      logger.warn(
        { err: lastError, attempt },
        "Overpass API fetch failed, retrying",
      );
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS * attempt);
      }
    }
  }

  throw lastError ?? new Error("Failed to fetch from Overpass API");
}
