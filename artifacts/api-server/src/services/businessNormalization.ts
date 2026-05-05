import type { InsertBusiness, Business } from "@workspace/db";

const CITY_ALIASES: Record<string, string> = {
  rome: "Roma",
  roma: "Roma",
  milan: "Milano",
  milano: "Milano",
  florence: "Firenze",
  firenze: "Firenze",
  naples: "Napoli",
  napoli: "Napoli",
  venice: "Venezia",
  venezia: "Venezia",
  london: "London",
  amsterdam: "Amsterdam",
  paris: "Paris",
  barcelona: "Barcelona",
  madrid: "Madrid",
  lisbon: "Lisbon",
  lisboa: "Lisbon",
  berlin: "Berlin",
  rotterdam: "Rotterdam",
  brussels: "Brussels",
  bruxelles: "Brussels",
  vienna: "Vienna",
  wien: "Vienna",
  "new york": "New York",
  "new-york": "New York",
  nyc: "New York",
};

function collapseWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeText(value: string): string {
  return collapseWhitespace(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function toTitleCase(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function normalizeCity(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = normalizeText(value);
  const aliased = CITY_ALIASES[normalized];
  if (aliased) return aliased;
  return toTitleCase(normalized);
}

export function normalizePhone(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = collapseWhitespace(value);
  const hasInternationalPrefix = trimmed.startsWith("+") || trimmed.startsWith("00");
  const digits = trimmed.replace(/\D+/g, "");
  if (!digits) return null;
  if (hasInternationalPrefix) {
    return `+${digits.replace(/^00/, "")}`;
  }
  return digits;
}

export function normalizeWebsite(value: string | null | undefined): string | null {
  if (!value) return null;

  const withProtocol = /^[a-z]+:\/\//i.test(value) ? value : `https://${value}`;

  try {
    const url = new URL(withProtocol);
    const host = url.hostname.replace(/^www\./i, "").toLowerCase();
    const pathname = url.pathname.replace(/\/+$/, "");
    const normalizedPath = pathname === "" ? "" : pathname.toLowerCase();
    return `https://${host}${normalizedPath}`;
  } catch {
    const normalized = normalizeText(value)
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/+$/, "");

    return normalized ? `https://${normalized}` : null;
  }
}

export function normalizeBusinessName(value: string): string {
  return normalizeText(value);
}

export function computeEnrichmentStatus(
  business: Pick<
    InsertBusiness | Business,
    "website" | "phone" | "googlePlaceId" | "googleMapsUrl" | "rating" | "userRatingsTotal"
  >,
): string {
  const hasPrimaryContact = Boolean(business.website) || Boolean(business.phone);
  const hasSecondarySignals =
    Boolean(business.googlePlaceId) ||
    Boolean(business.googleMapsUrl) ||
    business.rating !== null && business.rating !== undefined ||
    business.userRatingsTotal !== null && business.userRatingsTotal !== undefined;

  if (hasPrimaryContact && hasSecondarySignals) return "enriched";
  if (hasPrimaryContact || hasSecondarySignals) return "partially_enriched";
  return "pending";
}

export function normalizeIncomingBusiness(incoming: InsertBusiness): InsertBusiness {
  const city = normalizeCity(incoming.city);
  const website = normalizeWebsite(incoming.website);
  const phone = normalizePhone(incoming.phone);

  const normalized: InsertBusiness = {
    ...incoming,
    name: collapseWhitespace(incoming.name),
    addressLine: incoming.addressLine ? collapseWhitespace(incoming.addressLine) : null,
    city,
    postalCode: incoming.postalCode ? collapseWhitespace(incoming.postalCode) : null,
    region: incoming.region ? collapseWhitespace(incoming.region) : null,
    country: incoming.country ? collapseWhitespace(incoming.country) : null,
    website,
    phone,
    hasWebsite: Boolean(website),
    hasPhone: Boolean(phone),
  };

  normalized.enrichmentStatus = computeEnrichmentStatus(normalized);
  return normalized;
}

export function buildOsmKey(categorySlug: string, osmId: string | null | undefined, osmType: string | null | undefined): string | null {
  if (!osmId || !osmType) return null;
  return `${categorySlug}::${osmType}::${osmId}`;
}

export function buildWebsiteKey(categorySlug: string, website: string | null | undefined): string | null {
  const normalized = normalizeWebsite(website);
  if (!normalized) return null;
  return `${categorySlug}::${normalized.replace(/^https?:\/\//, "")}`;
}

export function buildCoordNameKey(categorySlug: string, name: string, latitude: string | number, longitude: string | number): string {
  const roundedLat = Number(latitude).toFixed(4);
  const roundedLon = Number(longitude).toFixed(4);
  return `${categorySlug}::${normalizeBusinessName(name)}::${roundedLat}::${roundedLon}`;
}

export function buildSlugKey(categorySlug: string, slug: string): string {
  return `${categorySlug}::${slug}`;
}
