import { createHash } from "node:crypto";
import type { InsertBusinessSource, InsertContactCandidate } from "@workspace/db";
import type { MergedBusinessRecord } from "./businessSourceService";
import { logger } from "../lib/logger";

const FETCH_TIMEOUT_MS = 8000;
const GENERIC_LOCAL_PARTS = [
  "info",
  "contact",
  "contacts",
  "hello",
  "office",
  "admin",
  "support",
  "gallery",
  "team",
  "press",
];
const CANDIDATE_PATHS = [
  "",
  "/contact",
  "/contacts",
  "/contatti",
  "/about",
  "/chi-siamo",
  "/privacy",
];

interface EnrichmentResult {
  sourceRecords: InsertBusinessSource[];
  contactCandidates: InsertContactCandidate[];
}

interface EmailMatch {
  email: string;
  sourceUrl: string;
  score: number;
  notes: string;
}

function normalizeHostname(value: string): string {
  return value.replace(/^www\./i, "").toLowerCase();
}

function normalizeWebsiteUrl(value: string): URL | null {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    parsed.hash = "";
    return parsed;
  } catch {
    return null;
  }
}

function buildCandidateUrls(baseUrl: URL): URL[] {
  const urls: URL[] = [];
  const seen = new Set<string>();

  for (const path of CANDIDATE_PATHS) {
    const candidate = new URL(path || "/", baseUrl);
    candidate.hash = "";
    if (candidate.origin !== baseUrl.origin) continue;

    const key = candidate.toString();
    if (seen.has(key)) continue;
    seen.add(key);
    urls.push(candidate);
  }

  return urls;
}

function looksLikeHtml(contentType: string | null): boolean {
  if (!contentType) return true;
  return contentType.toLowerCase().includes("text/html");
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function extractGenericEmails(html: string, websiteHost: string, pageUrl: string): EmailMatch[] {
  const emailRegex = /(?:mailto:)?([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi;
  const matches = new Map<string, EmailMatch>();

  for (const raw of html.matchAll(emailRegex)) {
    const email = (raw[1] ?? "").toLowerCase();
    if (!email) continue;

    const [localPart, domain] = email.split("@");
    if (!localPart || !domain) continue;
    if (!GENERIC_LOCAL_PARTS.includes(localPart)) continue;

    const normalizedDomain = normalizeHostname(domain);
    if (
      normalizedDomain !== websiteHost &&
      !normalizedDomain.endsWith(`.${websiteHost}`) &&
      !websiteHost.endsWith(`.${normalizedDomain}`)
    ) {
      continue;
    }

    const pathBonus = /contact|contatti/i.test(pageUrl) ? 0.08 : 0;
    const localPartBonus =
      localPart === "info" || localPart === "contact" ? 0.06 : 0;
    const score = Math.min(0.95, 0.82 + pathBonus + localPartBonus);

    matches.set(email, {
      email,
      sourceUrl: pageUrl,
      score,
      notes: `Generic email extracted from the official website page ${pageUrl}.`,
    });
  }

  return Array.from(matches.values());
}

async function fetchHtml(url: URL): Promise<{
  ok: boolean;
  status: number | null;
  fetchStatus: "fetched" | "failed" | "skipped";
  html: string | null;
  contentHash: string | null;
}> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "LocalBusinessDiscovery/1.0",
      },
      signal: controller.signal,
      redirect: "follow",
    });

    const status = response.status;
    const contentType = response.headers.get("content-type");
    if (!response.ok) {
      return { ok: false, status, fetchStatus: "failed", html: null, contentHash: null };
    }

    if (!looksLikeHtml(contentType)) {
      return { ok: false, status, fetchStatus: "skipped", html: null, contentHash: null };
    }

    const html = await response.text();
    return {
      ok: true,
      status,
      fetchStatus: "fetched",
      html,
      contentHash: sha256(html),
    };
  } catch (error) {
    logger.warn({ err: error, url: url.toString() }, "Official website fetch failed");
    return {
      ok: false,
      status: null,
      fetchStatus: "failed",
      html: null,
      contentHash: null,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function enrichOfficialWebsiteContacts(
  record: MergedBusinessRecord,
): Promise<EnrichmentResult> {
  const website = record.business.website;
  if (!website) {
    return { sourceRecords: [], contactCandidates: [] };
  }

  const baseUrl = normalizeWebsiteUrl(website);
  if (!baseUrl) {
    return { sourceRecords: [], contactCandidates: [] };
  }

  const candidateUrls = buildCandidateUrls(baseUrl);
  const sourceRecords: InsertBusinessSource[] = [];
  const emailMatches: EmailMatch[] = [];
  const websiteHost = normalizeHostname(baseUrl.hostname);

  for (const candidateUrl of candidateUrls) {
    const fetched = await fetchHtml(candidateUrl);
    const sourceType =
      normalizeWebsiteUrl(website)?.toString() === candidateUrl.toString()
        ? "official_website"
        : "official_website_page";

    sourceRecords.push({
      businessId: record.id,
      sourceType,
      sourceUrl: candidateUrl.toString(),
      sourceDomain: websiteHost,
      discoveredVia: "website_email_enrichment",
      fetchStatus: fetched.fetchStatus,
      lastFetchedAt: new Date(),
      contentHash: fetched.contentHash,
      httpStatus: fetched.status,
      isOfficial: true,
    });

    if (!fetched.ok || !fetched.html) continue;
    emailMatches.push(
      ...extractGenericEmails(fetched.html, websiteHost, candidateUrl.toString()),
    );
  }

  const bestEmail = emailMatches.sort((left, right) => right.score - left.score)[0];
  if (!bestEmail) {
    return { sourceRecords, contactCandidates: [] };
  }

  const candidateSourceType =
    bestEmail.sourceUrl === baseUrl.toString() ? "official_website" : "official_website_page";

  const contactCandidates: InsertContactCandidate[] = [
    {
      businessId: record.id,
      fullName: null,
      role: "general contact",
      contactType: "generic_email",
      email: bestEmail.email,
      phone: null,
      contactUrl: `mailto:${bestEmail.email}`,
      sourceUrl: bestEmail.sourceUrl,
      sourceType: candidateSourceType,
      confidenceScore: bestEmail.score.toFixed(2),
      isPrimary: false,
      isPersonalData: false,
      lastVerifiedAt: new Date(),
      reviewStatus: "suggested",
      notes: bestEmail.notes,
    },
  ];

  return { sourceRecords, contactCandidates };
}
