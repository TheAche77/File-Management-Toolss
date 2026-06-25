import { Router } from "express";
import type { Request, Response } from "express";
import { getConfiguredAdminToken } from "../lib/env";
import { ADMIN_SESSION_COOKIE } from "../lib/adminAuth";

const adminRouter = Router();

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

adminRouter.post("/admin/login", (req: Request, res: Response) => {
  const configuredToken = getConfiguredAdminToken();

  if (!configuredToken) {
    res.status(503).json({ error: "Admin auth is not configured on this server." });
    return;
  }

  const password: unknown = req.body?.password;
  if (typeof password !== "string" || password.trim() === "") {
    res.status(400).json({ error: "Password is required." });
    return;
  }

  if (password.trim() !== configuredToken) {
    res.status(401).json({ error: "Invalid admin password." });
    return;
  }

  res.cookie(ADMIN_SESSION_COOKIE, configuredToken, {
    httpOnly: true,
    sameSite: "strict",
    maxAge: SEVEN_DAYS_MS,
    path: "/",
    secure: process.env["NODE_ENV"] === "production",
  });

  res.json({ ok: true });
});

adminRouter.post("/admin/logout", (_req: Request, res: Response) => {
  res.clearCookie(ADMIN_SESSION_COOKIE, { path: "/" });
  res.json({ ok: true });
});

adminRouter.get("/admin/session", (req: Request, res: Response) => {
  const configuredToken = getConfiguredAdminToken();
  if (!configuredToken) {
    res.json({ authenticated: false });
    return;
  }

  const sessionToken: unknown = req.cookies?.[ADMIN_SESSION_COOKIE];
  const authenticated =
    typeof sessionToken === "string" && sessionToken.trim() === configuredToken;

  res.json({ authenticated });
});

export default adminRouter;
