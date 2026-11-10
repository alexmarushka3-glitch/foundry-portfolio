import { createHash } from "node:crypto";
import {
  LiveLimiter,
  browserKey,
  browserUsedUp,
  dayUsedUp,
  networkLimit,
  networkUsedUp,
  type LiveLimits,
} from "./rateLimit";
import { upstashConfig, upstashPipeline, type UpstashConfig } from "./upstash";

// The brake on live (paid) runs. Memory alone is per server instance and resets on a cold start. With an
// Upstash Redis database connected, the counts are shared by every instance and survive restarts.

export type LiveBrakeSnapshot = {
  perHour: number;
  perNetworkHour: number;
  perDay: number;
  usedToday: number;
  dayResetsAt: number;
  visitorsTracked: number;
};

export interface LiveBrake {
  /** Returns null when the run may go live, or the reason it can't (shown to the visitor). */
  check(visitor: string, browser?: string): Promise<string | null>;
  reset(): Promise<void>;
  snapshot(): Promise<LiveBrakeSnapshot>;
}

export class MemoryLiveBrake implements LiveBrake {
  constructor(private limiter: LiveLimiter) {}
  async check(visitor: string, browser?: string) {
    return this.limiter.check(visitor, browser);
  }
  async reset() {
    this.limiter.reset();
  }
  async snapshot() {
    return this.limiter.snapshot();
  }
}

const DAY_MS = 86_400_000;
const PREFIX = "foundry:live:";

/**
 * Counts in Redis. Each browser and each network get a count per hour, the whole site gets a count per UTC day
 * (fixed windows, so a visitor can get a few more runs across an hour boundary; it is still a brake, not a hard cap).
 * The address and browser id are hashed before they are stored. A refused run is not counted.
 */
export class RedisLiveBrake implements LiveBrake {
  constructor(
    private limits: LiveLimits,
    private config: UpstashConfig,
    private now: () => number = Date.now,
  ) {}

  private dayKey(): string {
    return `${PREFIX}d:${new Date(this.now()).toISOString().slice(0, 10)}`;
  }

  async check(visitor: string, browser?: string): Promise<string | null> {
    const hash = (v: string) => createHash("sha256").update(v).digest("hex").slice(0, 16);
    const mine = `${PREFIX}b:${hash(browserKey(visitor, browser))}`;
    const net = `${PREFIX}n:${hash(visitor)}`;
    const day = this.dayKey();
    const [b, n, d] = await upstashPipeline(this.config, [
      ["INCR", mine],
      ["INCR", net],
      ["INCR", day],
      ["EXPIRE", mine, 3600, "NX"],
      ["EXPIRE", net, 3600, "NX"],
      ["EXPIRE", day, 172_800, "NX"],
    ]);
    const reason =
      Number(d) > this.limits.perDay
        ? dayUsedUp
        : Number(b) > this.limits.perHour
          ? browserUsedUp(this.limits)
          : Number(n) > networkLimit(this.limits)
            ? networkUsedUp(this.limits)
            : null;
    if (reason)
      await upstashPipeline(this.config, [
        ["DECR", mine],
        ["DECR", net],
        ["DECR", day],
      ]);
    return reason;
  }

  private async keys(match: string): Promise<string[]> {
    const found: string[] = [];
    let cursor = "0";
    do {
      const [reply] = await upstashPipeline(this.config, [
        ["SCAN", cursor, "MATCH", match, "COUNT", 200],
      ]);
      const [next, batch] = reply as [string, string[]];
      cursor = String(next);
      found.push(...batch);
    } while (cursor !== "0");
    return found;
  }

  async reset(): Promise<void> {
    const keys = await this.keys(`${PREFIX}*`);
    if (keys.length) await upstashPipeline(this.config, [["DEL", ...keys]]);
  }

  async snapshot(): Promise<LiveBrakeSnapshot> {
    const [[used], visitors] = await Promise.all([
      upstashPipeline(this.config, [["GET", this.dayKey()]]),
      this.keys(`${PREFIX}b:*`),
    ]);
    const midnight = Math.floor(this.now() / DAY_MS) * DAY_MS + DAY_MS;
    return {
      perHour: this.limits.perHour,
      perNetworkHour: networkLimit(this.limits),
      perDay: this.limits.perDay,
      usedToday: Number(used) || 0,
      dayResetsAt: midnight,
      visitorsTracked: visitors.length,
    };
  }
}

/**
 * Keeps live runs braked when the database is down: it falls back to this instance's own counters
 * (with a note in the server log) instead of letting every run through.
 */
export class FallbackLiveBrake implements LiveBrake {
  constructor(
    private primary: LiveBrake,
    private memory: LiveBrake,
    private warn: (message: string) => void = (m) => console.warn(m),
  ) {}

  private async either<T>(what: string, run: (b: LiveBrake) => Promise<T>): Promise<T> {
    try {
      return await run(this.primary);
    } catch (err) {
      this.warn(
        `live brake: ${what} failed, using this instance's counters (${err instanceof Error ? err.message : "unknown"})`,
      );
      return run(this.memory);
    }
  }

  check(visitor: string, browser?: string) {
    return this.either("check", (b) => b.check(visitor, browser));
  }
  async reset() {
    await this.memory.reset();
    await this.either("reset", (b) => b.reset());
  }
  snapshot() {
    return this.either("read", (b) => b.snapshot());
  }
}

/** Redis (with the memory fallback) when the Upstash REST variables are set, memory otherwise. */
export function createLiveBrake(
  limits: LiveLimits,
  env: Record<string, string | undefined> = process.env,
): LiveBrake {
  const memory = new MemoryLiveBrake(new LiveLimiter(limits));
  const config = upstashConfig(env);
  return config ? new FallbackLiveBrake(new RedisLiveBrake(limits, config), memory) : memory;
}
