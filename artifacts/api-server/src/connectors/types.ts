import type { InsertBusiness } from "@workspace/db";
import type { BoundingBox } from "../lib/locationProfiles";
import { CITY_BBOXES } from "../lib/locationProfiles";
export type { BoundingBox } from "../lib/locationProfiles";
export { CITY_BBOXES, resolveLocationProfile as resolveCityProfile } from "../lib/locationProfiles";

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

export interface Connector {
  name: string;
  isAvailable(): boolean;
  fetch(options: ConnectorOptions): Promise<ConnectorResult>;
}

export function resolveBbox(city: string): BoundingBox {
  const key = city.toLowerCase().trim();
  return CITY_BBOXES[key] ?? CITY_BBOXES["rome"]!;
}
