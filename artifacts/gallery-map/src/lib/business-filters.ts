export const TARGET_MARKET_OPTIONS = [
  "IT",
  "UK",
  "NL",
  "FR",
  "ES",
  "PT",
  "RO",
] as const;

export type SharedBusinessFilters = {
  categorySlug: string;
  city: string;
  targetMarket: string;
};

type QueryValue = string | number | boolean | null | undefined;

export function readSearchParam(search: string, key: string) {
  return new URLSearchParams(search).get(key) ?? "";
}

export function readBooleanSearchParam(search: string, key: string) {
  return new URLSearchParams(search).get(key) === "true";
}

export function readNumberSearchParam(search: string, key: string, fallback: number) {
  const raw = new URLSearchParams(search).get(key);
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function readSharedBusinessFilters(search: string): SharedBusinessFilters {
  const params = new URLSearchParams(search);

  return {
    categorySlug: params.get("categorySlug") ?? "all",
    city: params.get("city") ?? "",
    targetMarket: params.get("targetMarket") ?? "all",
  };
}

export function buildSearchParams(
  currentSearch: string,
  updates: Record<string, QueryValue>,
) {
  const params = new URLSearchParams(currentSearch);

  for (const [key, value] of Object.entries(updates)) {
    if (
      value === undefined ||
      value === null ||
      value === "" ||
      value === false ||
      value === "all"
    ) {
      params.delete(key);
      continue;
    }

    params.set(key, String(value));
  }

  return params.toString();
}

export function syncSearchParams(search: string) {
  const pathname = window.location.pathname;
  const nextUrl = search ? `${pathname}?${search}` : pathname;
  window.history.replaceState(window.history.state, "", nextUrl);
}
