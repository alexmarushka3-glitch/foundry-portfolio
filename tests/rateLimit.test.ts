import { describe, expect, it } from "vitest";
import { envInt } from "@/lib/server/env";
import { LiveLimiter, SlidingWindowLimiter } from "@/lib/server/rateLimit";

const clock = (start = 1_000_000) => {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
};

describe("SlidingWindowLimiter", () => {
  it("allows the limit, refuses the next, and allows again once the window passes", () => {
    const c = clock();
    const l = new SlidingWindowLimiter(2, 1000, c.now);
    expect([l.hit("a"), l.hit("a"), l.hit("a")]).toEqual([true, true, false]);
    expect(l.hit("b")).toBe(true); // other keys are independent
    c.advance(1001);
    expect(l.hit("a")).toBe(true);
  });

  it("does not count refused hits", () => {
    const c = clock();
    const l = new SlidingWindowLimiter(1, 1000, c.now);
    l.hit("a");
    l.hit("a");
    l.hit("a");
    expect(l.used("a")).toBe(1);
  });

  it("forgets visitors who have not been seen for a whole window, so memory stays bounded", () => {
    const c = clock();
    const l = new SlidingWindowLimiter(3, 1000, c.now);
    for (let i = 0; i < 50; i++) l.hit(`visitor-${i}`);
    expect(l.keys).toBe(50);
    c.advance(1001);
    l.hit("someone-new");
    expect(l.keys).toBe(1);
  });
});

describe("LiveLimiter", () => {
  it("limits each visitor per hour with a message that says so", () => {
    const l = new LiveLimiter({ perHour: 2, perDay: 100 }, clock().now);
    expect(l.check("v")).toBeNull();
    expect(l.check("v")).toBeNull();
    expect(l.check("v")).toMatch(/2 live runs this hour/);
    expect(l.check("other")).toBeNull();
  });

  it("limits the whole site per day, and starts a new day after 24 hours", () => {
    const c = clock();
    const l = new LiveLimiter({ perHour: 99, perDay: 2 }, c.now);
    expect(l.check("a")).toBeNull();
    expect(l.check("b")).toBeNull();
    expect(l.check("c")).toMatch(/used up/);
    c.advance(86_400_001);
    expect(l.check("c")).toBeNull();
  });

  it("does not spend the daily allowance on a visitor who was refused", () => {
    const l = new LiveLimiter({ perHour: 1, perDay: 2 }, clock().now);
    l.check("a");
    l.check("a"); // refused: over the hourly limit
    expect(l.snapshot().usedToday).toBe(1);
  });

  it("can be reset", () => {
    const l = new LiveLimiter({ perHour: 1, perDay: 1 }, clock().now);
    l.check("a");
    expect(l.check("a")).not.toBeNull();
    l.reset();
    expect(l.check("a")).toBeNull();
  });
});

describe("envInt", () => {
  it("falls back for unset, empty, negative and non-numeric values", () => {
    delete process.env.TEST_INT;
    expect(envInt("TEST_INT", 3)).toBe(3);
    for (const bad of ["", "  ", "abc", "-4"]) {
      process.env.TEST_INT = bad;
      expect(envInt("TEST_INT", 3)).toBe(3);
    }
  });
  it("reads real numbers, including zero", () => {
    process.env.TEST_INT = "7";
    expect(envInt("TEST_INT", 3)).toBe(7);
    process.env.TEST_INT = "0";
    expect(envInt("TEST_INT", 3)).toBe(0);
    delete process.env.TEST_INT;
  });
});
