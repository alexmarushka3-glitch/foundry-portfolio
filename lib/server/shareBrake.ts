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
  /** Gives back the count of a link that was allowed but then could not be saved (the database failed). */
  release(visitor: string): Promise<void>;
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
    // The address is counted first and the site's day only once the address passes, so one address that keeps
    // asking cannot use up everyone's day (RedisShareBrake does the same).
    if (this.perAddress.used(visitor) >= this.limits.perHour) return addressUsedUp(this.limits);
    if (this.perDay.used("site") >= this.limits.perDay) return dayUsedUp;
    this.perAddress.hit(visitor);
    this.perDay.hit("site");
    return null;
  }

  async release(): Promise<void> {
    // Memory counters are for local development only, where the database is never involved.
  }
}

const PREFIX = "foundry:share:";

export class RedisShareBrake implements ShareBrake {
  constructor(
    private limits: ShareLimits,
    private config: UpstashConfig,
    private now: () => number = Date.now,
  ) {}

  private keys(visitor: string) {
    const hash = createHash("sha256").update(visitor).digest("hex").slice(0, 16);
    return {
      mine: `${PREFIX}a:${hash}`,
      day: `${PREFIX}d:${new Date(this.now()).toISOString().slice(0, 10)}`,
    };
  }

  async check(visitor: string): Promise<string | null> {
    const { mine, day } = this.keys(visitor);
    // Each count and its expiry go in one transaction, so a counter never exists without its expiry.
    const [a] = await upstashTransaction(this.config, [
      ["INCR", mine],
      ["EXPIRE", mine, 3600, "NX"],
    ]);
    // An address that is over its hour is refused here, before it touches the site's day total. Otherwise one address
    // asking again and again could use up the day for everyone.
    if (Number(a) > this.limits.perHour) return addressUsedUp(this.limits);
    let d: unknown;
    try {
      [d] = await upstashTransaction(this.config, [
        ["INCR", day],
        ["EXPIRE", day, 172_800, "NX"],
      ]);
    } catch (err) {
      // The address was counted but the link will not go ahead, so give that back before reporting the failure.
      await upstashTransaction(this.config, [["DECR", mine]]).catch(() => {});
      throw err;
    }
    if (Number(d) <= this.limits.perDay) return null;
    // Over the day's total: neither counter should keep this request, or the address would stay charged and the
    // total would read full even after a saved link is given back.
    await this.release(visitor);
    return dayUsedUp;
  }

  async release(visitor: string): Promise<void> {
    const { mine, day } = this.keys(visitor);
    const [a, d] = await upstashTransaction(this.config, [
      ["DECR", mine],
      ["DECR", day],
    ]);
    // A counter that already expired (or rolled over at midnight) would now sit at -1 with no expiry. Put it back.
    const repair: (string | number)[][] = [];
    if (Number(a) < 0) repair.push(["INCR", mine], ["EXPIRE", mine, 3600, "NX"]);
    if (Number(d) < 0) repair.push(["INCR", day], ["EXPIRE", day, 172_800, "NX"]);
    if (repair.length) await upstashTransaction(this.config, repair);
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
