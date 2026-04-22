export type SharedFilterParams = {
  city: string;
  categorySlug: string;
  targetMarket: string;
};

export function readSharedBusinessFilters(search: string): SharedFilterParams {
  const params = new URLSearchParams(search);
  return {
    city: params.get("city") ?? "",
    categorySlug: params.get("categorySlug") ?? "all",
    targetMarket: params.get("targetMarket") ?? "all",
  };
}

export function buildSearchParams(
  currentSearch: string,
  updates: Record<string, string | undefined>,
): URLSearchParams {
  const params = new URLSearchParams(currentSearch);
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined || value === "" || value === "all") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
  }
  return params;
}

export function syncSearchParams(params: URLSearchParams): void {
  const search = params.toString();
  const next = search ? `?${search}` : window.location.pathname;
  window.history.replaceState(null, "", next);
}
