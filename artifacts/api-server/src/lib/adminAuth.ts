import type { NextFunction, Request, Response } from "express";
import { logger } from "./logger";
import { getConfiguredAdminToken } from "./env";

let warnedAboutMissingToken = false;

function extractBearerToken(req: Request): string | null {
  const authorizationHeader = req.header("authorization");
  if (authorizationHeader?.startsWith("Bearer ")) {
    return authorizationHeader.slice("Bearer ".length).trim();
  }

  const fallbackHeader = req.header("x-admin-token");
  return fallbackHeader?.trim() || null;
}

export function requireAdminAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const configuredToken = getConfiguredAdminToken();

  if (!configuredToken) {
    if (!warnedAboutMissingToken) {
      warnedAboutMissingToken = true;
      logger.warn(
        "ADMIN_API_TOKEN is not configured; denying access to protected admin routes.",
      );
    }
    res.status(503).json({ error: "Admin auth is not configured" });
    return;
  }

  const providedToken = extractBearerToken(req);
  if (providedToken !== configuredToken) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  next();
}
