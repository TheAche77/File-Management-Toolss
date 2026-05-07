import { logger } from "../lib/logger";

export interface RateLimitConfig {
  bucket: string;
  maxRequests: number;
  intervalMs: number;
  concurrency: number;
  failureThreshold?: number;
  circuitOpenMs?: number;
}

interface RateLimitState {
  timestamps: number[];
  active: number;
  failures: number;
  circuitOpenUntil: number;
}

export class RateLimiterService {
  private readonly states = new Map<string, RateLimitState>();

  async schedule<T>(config: RateLimitConfig, task: () => Promise<T>): Promise<T> {
    const state = this.getState(config.bucket);
    await this.waitForSlot(config, state);

    state.active += 1;
    state.timestamps.push(Date.now());
    try {
      const result = await task();
      state.failures = 0;
      return result;
    } catch (err) {
      state.failures += 1;
      if (state.failures >= (config.failureThreshold ?? 5)) {
        state.circuitOpenUntil = Date.now() + (config.circuitOpenMs ?? 60_000);
        logger.warn(
          { bucket: config.bucket, failures: state.failures, circuitOpenUntil: state.circuitOpenUntil },
          "External enrichment circuit opened",
        );
      }
      throw err;
    } finally {
      state.active -= 1;
      this.prune(config, state);
    }
  }

  private getState(bucket: string): RateLimitState {
    const existing = this.states.get(bucket);
    if (existing) return existing;
    const state: RateLimitState = {
      timestamps: [],
      active: 0,
      failures: 0,
      circuitOpenUntil: 0,
    };
    this.states.set(bucket, state);
    return state;
  }

  private async waitForSlot(config: RateLimitConfig, state: RateLimitState) {
    while (true) {
      const now = Date.now();
      this.prune(config, state);

      if (state.circuitOpenUntil > now) {
        await sleep(Math.min(state.circuitOpenUntil - now, 5_000));
        continue;
      }

      if (state.active < config.concurrency && state.timestamps.length < config.maxRequests) {
        return;
      }

      const oldest = state.timestamps[0] ?? now;
      const waitMs = Math.max(100, Math.min(oldest + config.intervalMs - now, 5_000));
      await sleep(waitMs);
    }
  }

  private prune(config: RateLimitConfig, state: RateLimitState) {
    const cutoff = Date.now() - config.intervalMs;
    state.timestamps = state.timestamps.filter((timestamp) => timestamp > cutoff);
  }
}

export function getRetryDelayMs(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number.parseInt(retryAfter, 10);
    if (Number.isFinite(seconds)) return Math.max(seconds * 1000, 1000);
  }
  return Math.min(30_000, 1000 * 2 ** attempt);
}

export async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export const enrichmentRateLimiter = new RateLimiterService();
