interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class EnrichmentCache {
  private readonly cache = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.cache.delete(key);
      return null;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  hasFresh(key: string): boolean {
    return this.get(key) !== null;
  }
}

export const enrichmentCache = new EnrichmentCache();

export const CACHE_TTLS = {
  stableExternalId: 7 * 24 * 60 * 60 * 1000,
  apiResponse: 24 * 60 * 60 * 1000,
  negativeLookup: 60 * 60 * 1000,
};
