import type { InsertBusiness } from "@workspace/db";

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

export interface Connector {
  name: string;
  isAvailable(): boolean;
  fetch(options: ConnectorOptions): Promise<ConnectorResult>;
}

export const CITY_BBOXES: Record<string, BoundingBox> = {
  rome: { south: 41.8, west: 12.3, north: 42.0, east: 12.6 },
  milan: { south: 45.4, west: 9.1, north: 45.5, east: 9.3 },
  florence: { south: 43.7, west: 11.2, north: 43.8, east: 11.3 },
  naples: { south: 40.8, west: 14.2, north: 40.9, east: 14.3 },
  venice: { south: 45.4, west: 12.3, north: 45.5, east: 12.4 },
};

export function resolveBbox(city: string): BoundingBox {
  const key = city.toLowerCase().trim();
  return CITY_BBOXES[key] ?? CITY_BBOXES["rome"]!;
}
