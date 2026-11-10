/** Allows `limit` hits per key inside a sliding window. Stale keys are dropped so memory stays bounded. */
export class SlidingWindowLimiter {
  private hits = new Map<string, number[]>();

  constructor(
    private limit: number,
    private windowMs: number,
    private now: () => number = Date.now,
  ) {}

  /** Count one hit for `key`. Returns false (and does not count it) when the key is over the limit. */
  hit(key: string): boolean {
    const now = this.now();
    this.prune(now);
    const recent = this.hits.get(key) ?? [];
    if (recent.length >= this.limit) return false;
    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }

  /** Hits that still count for `key`. Does not record anything. */
  used(key: string): number {
    const now = this.now();
    return (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs).length;
  }

  reset(): void {
    this.hits.clear();
  }

  get keys(): number {
    return this.hits.size;
  }

  private prune(now: number): void {
    for (const [key, times] of this.hits) {
      const live = times.filter((t) => now - t < this.windowMs);
      if (live.length === 0) this.hits.delete(key);
      else if (live.length !== times.length) this.hits.set(key, live);
    }
  }
}

export type LiveLimits = {
  /** Live runs per browser per hour. */
  perHour: number;
  /** Live runs per day for the whole site. */
  perDay: number;
  /** Live runs per network (IP address) per hour, shared by every browser on it. Never below perHour. */
  perNetworkHour?: number;
};

export const networkLimit = (l: LiveLimits) => Math.max(l.perHour, l.perNetworkHour ?? l.perHour);
export const browserUsedUp = (l: LiveLimits) =>
  `You've used ${l.perHour} live runs this hour, so this one is a simulation.`;
export const networkUsedUp = (l: LiveLimits) =>
  `Your network (for example a shared Wi-Fi) has used its ${networkLimit(l)} live runs this hour, so this one is a simulation.`;
export const dayUsedUp = "Today's live runs are used up, so this one is a simulation.";

/** The key a browser is counted under: its cookie id, or its address when it sent none. */
export const browserKey = (visitor: string, browser?: string) =>
  browser ? `b:${browser}` : `a:${visitor}`;

/**
 * The brake on live (paid) runs: a few per browser per hour, a few more per network per hour (so people on one
 * Wi-Fi each get their own, but clearing cookies doesn't give endless runs), and a daily total for the whole site.
 * On serverless hosting each instance keeps its own counters, so this is a brake and not a hard cap.
 * The hard cap is the spend limit in the Anthropic console.
 */
export class LiveLimiter {
  private perBrowser: SlidingWindowLimiter;
  private perNetwork: SlidingWindowLimiter;
  private dayStart: number;
  private dayCount = 0;

  constructor(
    public limits: LiveLimits,
    private now: () => number = Date.now,
  ) {
    this.perBrowser = new SlidingWindowLimiter(limits.perHour, 3_600_000, now);
    this.perNetwork = new SlidingWindowLimiter(networkLimit(limits), 3_600_000, now);
    this.dayStart = now();
  }

  /** Returns null when the run may go live, or the reason it can't (shown to the visitor). */
  check(visitor: string, browser?: string): string | null {
    const now = this.now();
    if (now - this.dayStart > 86_400_000) {
      this.dayStart = now;
      this.dayCount = 0;
    }
    if (this.dayCount >= this.limits.perDay) return dayUsedUp;
    const key = browserKey(visitor, browser);
    if (this.perBrowser.used(key) >= this.limits.perHour) return browserUsedUp(this.limits);
    if (this.perNetwork.used(visitor) >= networkLimit(this.limits))
      return networkUsedUp(this.limits);
    this.perBrowser.hit(key);
    this.perNetwork.hit(visitor);
    this.dayCount += 1;
    return null;
  }

  reset(): void {
    this.perBrowser.reset();
    this.perNetwork.reset();
    this.dayStart = this.now();
    this.dayCount = 0;
  }

  snapshot() {
    return {
      perHour: this.limits.perHour,
      perNetworkHour: networkLimit(this.limits),
      perDay: this.limits.perDay,
      usedToday: this.dayCount,
      dayResetsAt: this.dayStart + 86_400_000,
      visitorsTracked: this.perBrowser.keys,
    };
  }
}
