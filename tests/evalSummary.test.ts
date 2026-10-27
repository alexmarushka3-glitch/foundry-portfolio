import { describe, expect, it } from "vitest";
import { summarizeRuns, type EvalRun } from "@/lib/eval/summarize";

const run = (over: Partial<EvalRun> = {}): EvalRun => ({ approved: true, rounds: 1, costUsd: 0.1, ms: 40_000, ...over });

describe("summarizeRuns", () => {
  it("returns zero counts and no rate for an empty list, so the site shows nothing", () => {
    expect(summarizeRuns([])).toEqual({ total: 0, approved: 0, sentBack: 0, rate: null, low: null, high: null, avgCostUsd: null, avgMs: null });
  });

  it("counts approved runs and runs the Validator sent back at least once", () => {
    const s = summarizeRuns([run(), run({ rounds: 2 }), run({ approved: false, rounds: 2 })]);
    expect(s.total).toBe(3);
    expect(s.approved).toBe(2);
    expect(s.sentBack).toBe(2);
    expect(s.rate).toBeCloseTo(2 / 3, 5);
  });

  it("averages cost and time over all runs, including the ones that were not approved", () => {
    const s = summarizeRuns([run({ costUsd: 0.1, ms: 40_000 }), run({ approved: false, costUsd: 0.3, ms: 80_000 })]);
    expect(s.avgCostUsd).toBeCloseTo(0.2, 5);
    expect(s.avgMs).toBe(60_000);
  });

  it("gives a wide 95% interval for a handful of runs, so one good week cannot read as a success rate", () => {
    const s = summarizeRuns(Array.from({ length: 5 }, () => run()));
    expect(s.rate).toBe(1);
    expect(s.low!).toBeLessThan(0.6);
    expect(s.high!).toBeCloseTo(1, 5);
  });

  it("narrows the interval as runs are added", () => {
    const few = summarizeRuns(Array.from({ length: 5 }, () => run()));
    const many = summarizeRuns(Array.from({ length: 50 }, () => run()));
    expect(many.low!).toBeGreaterThan(few.low!);
  });
});
