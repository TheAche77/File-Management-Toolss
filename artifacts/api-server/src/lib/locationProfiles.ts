export interface BoundingBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface LocationProfile {
  canonicalCity: string;
  country: string;
  targetMarket: "IT" | "UK" | "NL" | "FR" | "ES" | "PT" | "RO";
  bbox: BoundingBox;
  aliases: string[];
}

const LOCATION_PROFILES: LocationProfile[] = [
  {
    canonicalCity: "Rome",
    country: "Italy",
    targetMarket: "IT",
    bbox: { south: 41.8, west: 12.3, north: 42.0, east: 12.6 },
    aliases: ["rome", "roma"],
  },
  {
    canonicalCity: "Milan",
    country: "Italy",
    targetMarket: "IT",
    bbox: { south: 45.4, west: 9.1, north: 45.5, east: 9.3 },
    aliases: ["milan", "milano"],
  },
  {
    canonicalCity: "Florence",
    country: "Italy",
    targetMarket: "IT",
    bbox: { south: 43.7, west: 11.2, north: 43.8, east: 11.3 },
    aliases: ["florence", "firenze"],
  },
  {
    canonicalCity: "Naples",
    country: "Italy",
    targetMarket: "IT",
    bbox: { south: 40.8, west: 14.2, north: 40.9, east: 14.3 },
    aliases: ["naples", "napoli"],
  },
  {
    canonicalCity: "Venice",
    country: "Italy",
    targetMarket: "IT",
    bbox: { south: 45.4, west: 12.3, north: 45.5, east: 12.4 },
    aliases: ["venice", "venezia"],
  },
  {
    canonicalCity: "London",
    country: "United Kingdom",
    targetMarket: "UK",
    bbox: { south: 51.45, west: -0.2, north: 51.55, east: 0.0 },
    aliases: ["london"],
  },
  {
    canonicalCity: "Amsterdam",
    country: "Netherlands",
    targetMarket: "NL",
    bbox: { south: 52.34, west: 4.85, north: 52.42, east: 5.0 },
    aliases: ["amsterdam"],
  },
  {
    canonicalCity: "Paris",
    country: "France",
    targetMarket: "FR",
    bbox: { south: 48.82, west: 2.28, north: 48.9, east: 2.42 },
    aliases: ["paris"],
  },
  {
    canonicalCity: "Barcelona",
    country: "Spain",
    targetMarket: "ES",
    bbox: { south: 41.35, west: 2.1, north: 41.44, east: 2.22 },
    aliases: ["barcelona"],
  },
  {
    canonicalCity: "Lisbon",
    country: "Portugal",
    targetMarket: "PT",
    bbox: { south: 38.69, west: -9.23, north: 38.75, east: -9.09 },
    aliases: ["lisbon", "lisboa"],
  },
  {
    canonicalCity: "Bucharest",
    country: "Romania",
    targetMarket: "RO",
    bbox: { south: 44.39, west: 26.02, north: 44.47, east: 26.16 },
    aliases: ["bucharest", "bucuresti", "bucurești"],
  },
];

const COUNTRY_TO_TARGET_MARKET: Record<string, LocationProfile["targetMarket"]> = {
  italy: "IT",
  italia: "IT",
  "united kingdom": "UK",
  uk: "UK",
  england: "UK",
  britain: "UK",
  "great britain": "UK",
  netherlands: "NL",
  holland: "NL",
  france: "FR",
  spain: "ES",
  españa: "ES",
  espana: "ES",
  portugal: "PT",
  romania: "RO",
};

function normalizeLookupValue(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export const CITY_BBOXES: Record<string, BoundingBox> = Object.fromEntries(
  LOCATION_PROFILES.flatMap((profile) =>
    profile.aliases.map((alias) => [alias, profile.bbox] as const),
  ),
);

export function resolveLocationProfile(city: string): LocationProfile | null {
  const normalizedCity = normalizeLookupValue(city);
  return (
    LOCATION_PROFILES.find((profile) =>
      profile.aliases.some((alias) => normalizeLookupValue(alias) === normalizedCity),
    ) ?? null
  );
}

export function inferTargetMarket(
  city: string | null | undefined,
  country: string | null | undefined,
): LocationProfile["targetMarket"] | null {
  if (city) {
    const profile = resolveLocationProfile(city);
    if (profile) return profile.targetMarket;
  }

  if (!country) return null;
  return COUNTRY_TO_TARGET_MARKET[normalizeLookupValue(country)] ?? null;
}

export function inferCountry(city: string | null | undefined): string | null {
  if (!city) return null;
  return resolveLocationProfile(city)?.country ?? null;
}
