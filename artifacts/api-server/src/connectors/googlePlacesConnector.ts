import type { Connector, ConnectorOptions, ConnectorResult } from "./types";
import { logger } from "../lib/logger";

export class GooglePlacesConnector implements Connector {
  name = "google";

  isAvailable(): boolean {
    return !!process.env["GOOGLE_MAPS_API_KEY"];
  }

  async fetch(_options: ConnectorOptions): Promise<ConnectorResult> {
    logger.info("Google Places connector invoked but not yet implemented");
    return { items: [], source: "google", errors: [] };
  }
}
