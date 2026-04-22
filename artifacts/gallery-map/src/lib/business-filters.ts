export type SharedBusinessFiltersState = {
  search: string;
  city: string;
  categorySlug: string;
  targetMarket: string;
  hasWebsite: boolean;
  hasPhone: boolean;
  readyForOutreach: boolean;
  reviewRequired: boolean;
  page: number;
  horizonDays?: number;
  limit?: number;
};

export function readSharedBusinessFilters(search: string): SharedBusinessFiltersState {
  const params = new URLSearchParams(search);

  return {
    search: params.get("search") ?? "",
    city: params.get("city") ?? "",
    categorySlug: params.get("categorySlug") ?? "all",
    targetMarket: params.get("targetMarket") ?? "all",
    hasWebsite: params.get("hasWebsite") === "true",
    hasPhone: params.get("hasPhone") === "true",
    readyForOutreach: params.get("readyForOutreach") === "true",
    reviewRequired: params.get("reviewRequired") === "true",
    page: Number.parseInt(params.get("page") ?? "1", 10) || 1,
    horizonDays: params.get("horizonDays")
      ? Number.parseInt(params.get("horizonDays") ?? "7", 10) || 7
      : undefined,
    limit: params.get("limit")
      ? Number.parseInt(params.get("limit") ?? "50", 10) || 50
      : undefined,
  };
}

export function buildSearchParams(
  currentSearch: string,
  updates: Partial<SharedBusinessFiltersState>,
) {
  const current = readSharedBusinessFilters(currentSearch);
  const next = { ...current, ...updates };
  const params = new URLSearchParams();

  const setString = (key: string, value: string, emptyValue = "") => {
    if (value && value !== emptyValue) {
      params.set(key, value);
    }
  };

  setString("search", next.search);
  setString("city", next.city);
  setString("categorySlug", next.categorySlug, "all");
  setString("targetMarket", next.targetMarket, "all");
  if (next.hasWebsite) params.set("hasWebsite", "true");
  if (next.hasPhone) params.set("hasPhone", "true");
  if (next.readyForOutreach) params.set("readyForOutreach", "true");
  if (next.reviewRequired) params.set("reviewRequired", "true");
  if (next.page && next.page > 1) params.set("page", String(next.page));
  if (next.horizonDays) params.set("horizonDays", String(next.horizonDays));
  if (next.limit) params.set("limit", String(next.limit));

  return params.toString();
}

export function syncSearchParams(search: string) {
  const nextUrl = search ? `${window.location.pathname}?${search}` : window.location.pathname;
  window.history.replaceState(null, "", nextUrl);
}
