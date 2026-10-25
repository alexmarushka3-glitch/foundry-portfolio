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

export type LiveLimits = { perHour: number; perDay: number };

/**
 * The brake on live (paid) runs: a few per visitor per hour, and a daily total for the whole site.
 * On serverless hosting each instance keeps its own counters, so this is a brake and not a hard cap.
 * The hard cap is the spend limit in the Anthropic console.
 */
export class LiveLimiter {
  private perVisitor: SlidingWindowLimiter;
  private dayStart: number;
  private dayCount = 0;

  constructor(
    public limits: LiveLimits,
    private now: () => number = Date.now,
  ) {
    this.perVisitor = new SlidingWindowLimiter(limits.perHour, 3_600_000, now);
    this.dayStart = now();
  }

  /** Returns null when the run may go live, or the reason it can't (shown to the visitor). */
  check(visitor: string): string | null {
    const now = this.now();
    if (now - this.dayStart > 86_400_000) {
      this.dayStart = now;
      this.dayCount = 0;
    }
    if (this.dayCount >= this.limits.perDay) return "Today's live runs are used up, so this one is a simulation.";
    if (!this.perVisitor.hit(visitor)) {
      return `You've used ${this.limits.perHour} live runs this hour, so this one is a simulation.`;
    }
    this.dayCount += 1;
    return null;
  }

  reset(): void {
    this.perVisitor.reset();
    this.dayStart = this.now();
    this.dayCount = 0;
  }

  snapshot() {
    return {
      perHour: this.limits.perHour,
      perDay: this.limits.perDay,
      usedToday: this.dayCount,
      dayResetsAt: this.dayStart + 86_400_000,
      visitorsTracked: this.perVisitor.keys,
    };
  }
}
