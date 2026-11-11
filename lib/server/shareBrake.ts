import { createHash } from "node:crypto";
import { SlidingWindowLimiter } from "./rateLimit";
import { upstashConfig, upstashTransaction, type UpstashConfig } from "./upstash";

// How often hosted links may be made: a few per address per hour, and a day total for the whole site. The day total
// is what bounds storage (links last a week), so it is shared through Redis when that is connected.

export type ShareLimits = { perHour: number; perDay: number };

export const addressUsedUp = (l: ShareLimits) =>
  `You've made ${l.perHour} links this hour. Try again later, or use Save the app.`;
export const dayUsedUp = "Links are paused for today. Use Save the app.";

export interface ShareBrake {
  /** Counts one link for this address. Returns why it is refused, or null when it may go ahead. */
  check(visitor: string): Promise<string | null>;
}

export class MemoryShareBrake implements ShareBrake {
  private perAddress: SlidingWindowLimiter;
  private perDay: SlidingWindowLimiter;

  constructor(
    private limits: ShareLimits,
    now: () => number = Date.now,
  ) {
    this.perAddress = new SlidingWindowLimiter(limits.perHour, 3_600_000, now);
    this.perDay = new SlidingWindowLimiter(limits.perDay, 86_400_000, now);
  }

  async check(visitor: string): Promise<string | null> {
    // A refused request is not counted here, and a Redis one is (see RedisShareBrake); both stay refused until the window ends.
    if (this.perDay.used("site") >= this.limits.perDay) return dayUsedUp;
    if (this.perAddress.used(visitor) >= this.limits.perHour) return addressUsedUp(this.limits);
    this.perDay.hit("site");
    this.perAddress.hit(visitor);
    return null;
  }
}

const PREFIX = "foundry:share:";

export class RedisShareBrake implements ShareBrake {
  constructor(
    private limits: ShareLimits,
    private config: UpstashConfig,
    private now: () => number = Date.now,
  ) {}

  async check(visitor: string): Promise<string | null> {
    const hash = createHash("sha256").update(visitor).digest("hex").slice(0, 16);
    const mine = `${PREFIX}a:${hash}`;
    const day = `${PREFIX}d:${new Date(this.now()).toISOString().slice(0, 10)}`;
    // One transaction, so a counter never exists without its expiry.
    const [a, d] = await upstashTransaction(this.config, [
      ["INCR", mine],
      ["INCR", day],
      ["EXPIRE", mine, 3600, "NX"],
      ["EXPIRE", day, 172_800, "NX"],
    ]);
    const reason =
      Number(d) > this.limits.perDay
        ? dayUsedUp
        : Number(a) > this.limits.perHour
          ? addressUsedUp(this.limits)
          : null;
    // A refusal is not refunded. The counters only matter up to their limits, a refused request costs one Redis
    // call instead of two, and an address that keeps hammering stays refused until its hour is up.
    return reason;
  }
}

/** Redis when the Upstash REST variables are set, memory otherwise. */
export function createShareBrake(
  limits: ShareLimits,
  env: Record<string, string | undefined> = process.env,
): ShareBrake {
  const config = upstashConfig(env);
  return config ? new RedisShareBrake(limits, config) : new MemoryShareBrake(limits);
}
