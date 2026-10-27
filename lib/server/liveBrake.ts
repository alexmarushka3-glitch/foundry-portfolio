import { createHash } from "node:crypto";
import { LiveLimiter, type LiveLimits } from "./rateLimit";
import { upstashConfig, upstashPipeline, type UpstashConfig } from "./upstash";

// The brake on live (paid) runs. Memory alone is per server instance and resets on a cold start. With an
// Upstash Redis database connected, the counts are shared by every instance and survive restarts.

export type LiveBrakeSnapshot = {
  perHour: number;
  perDay: number;
  usedToday: number;
  dayResetsAt: number;
  visitorsTracked: number;
};

export interface LiveBrake {
  /** Returns null when the run may go live, or the reason it can't (shown to the visitor). */
  check(visitor: string): Promise<string | null>;
  reset(): Promise<void>;
  snapshot(): Promise<LiveBrakeSnapshot>;
}

export class MemoryLiveBrake implements LiveBrake {
  constructor(private limiter: LiveLimiter) {}
  async check(visitor: string) {
    return this.limiter.check(visitor);
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
const dayUsedUp = "Today's live runs are used up, so this one is a simulation.";

/**
 * Counts in Redis. Visitors get a count per hour, the whole site gets a count per UTC day (fixed windows,
 * so a visitor can get a few more runs across an hour boundary; it is still a brake, not a hard cap).
 * The visitor address is hashed before it is stored. A refused run is not counted.
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

  async check(visitor: string): Promise<string | null> {
    const hour = `${PREFIX}h:${createHash("sha256").update(visitor).digest("hex").slice(0, 16)}`;
    const day = this.dayKey();
    const [h, d] = await upstashPipeline(this.config, [
      ["INCR", hour],
      ["INCR", day],
      ["EXPIRE", hour, 3600, "NX"],
      ["EXPIRE", day, 172_800, "NX"],
    ]);
    const tooManyToday = Number(d) > this.limits.perDay;
    const tooManyThisHour = Number(h) > this.limits.perHour;
    if (tooManyToday || tooManyThisHour) {
      await upstashPipeline(this.config, [["DECR", hour], ["DECR", day]]);
      return tooManyToday ? dayUsedUp : `You've used ${this.limits.perHour} live runs this hour, so this one is a simulation.`;
    }
    return null;
  }

  private async keys(match: string): Promise<string[]> {
    const found: string[] = [];
    let cursor = "0";
    do {
      const [reply] = await upstashPipeline(this.config, [["SCAN", cursor, "MATCH", match, "COUNT", 200]]);
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
    const [[used], visitors] = await Promise.all([upstashPipeline(this.config, [["GET", this.dayKey()]]), this.keys(`${PREFIX}h:*`)]);
    const midnight = Math.floor(this.now() / DAY_MS) * DAY_MS + DAY_MS;
    return {
      perHour: this.limits.perHour,
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
      this.warn(`live brake: ${what} failed, using this instance's counters (${err instanceof Error ? err.message : "unknown"})`);
      return run(this.memory);
    }
  }

  check(visitor: string) {
    return this.either("check", (b) => b.check(visitor));
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
export function createLiveBrake(limits: LiveLimits, env: Record<string, string | undefined> = process.env): LiveBrake {
  const memory = new MemoryLiveBrake(new LiveLimiter(limits));
  const config = upstashConfig(env);
  return config ? new FallbackLiveBrake(new RedisLiveBrake(limits, config), memory) : memory;
}
