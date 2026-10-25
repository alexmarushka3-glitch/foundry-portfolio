import { describe, expect, it } from "vitest";
import {
  agentTimings,
  bucketRuns,
  countBy,
  DEFAULT_FILTERS,
  filterRuns,
  filtersActive,
  kpis,
  paginate,
  sortRuns,
  toCsv,
} from "@/lib/admin/aggregate";
import type { RunRecord } from "@/lib/server/runLog";

const NOW = Date.UTC(2026, 9, 24, 12, 30, 0);
const HOUR = 3_600_000;

let n = 0;
const run = (over: Partial<RunRecord> = {}): RunRecord => ({
  id: `r${n++}`,
  at: NOW - 60_000,
  request: "Add a nickname",
  mode: "live",
  status: "approved",
  ms: 40_000,
  rounds: 1,
  costUsd: 0.08,
  inputTokens: 1000,
  outputTokens: 500,
  agentMs: {},
  visitor: "aaaa1111",
  ...over,
});

describe("filterRuns", () => {
  const runs = [
    run({ id: "recent-live" }),
    run({ id: "old", at: NOW - 3 * 24 * HOUR }),
    run({ id: "sim", mode: "simulated", request: "Dark mode" }),
    run({ id: "err", status: "error", visitor: "bbbb2222" }),
  ];
  const ids = (f: Partial<typeof DEFAULT_FILTERS>) => filterRuns(runs, { ...DEFAULT_FILTERS, ...f }, NOW).map((r) => r.id);

  it("applies the time range", () => {
    expect(ids({ range: "24h" })).not.toContain("old");
    expect(ids({ range: "7d" })).toContain("old");
    expect(ids({ range: "1h" })).toEqual(["recent-live", "sim", "err"]);
  });
  it("filters by mode and result", () => {
    expect(ids({ mode: "simulated" })).toEqual(["sim"]);
    expect(ids({ status: "error" })).toEqual(["err"]);
  });
  it("searches idea text and visitor, ignoring case", () => {
    expect(ids({ query: "DARK" })).toEqual(["sim"]);
    expect(ids({ query: "bbbb" })).toEqual(["err"]);
  });
  it("knows when filters differ from the defaults", () => {
    expect(filtersActive(DEFAULT_FILTERS)).toBe(false);
    expect(filtersActive({ ...DEFAULT_FILTERS, query: " x " })).toBe(true);
  });
});

describe("kpis", () => {
  it("counts finished runs only for approval rate and average time", () => {
    const k = kpis([
      run({ status: "approved", ms: 30_000 }),
      run({ status: "not-approved", ms: 50_000 }),
      run({ status: "error", ms: 1_000 }),
      run({ status: "cancelled", ms: 2_000, mode: "simulated", costUsd: 0 }),
    ]);
    expect(k.total).toBe(4);
    expect(k.approvalRate).toBe(0.5);
    expect(k.avgMs).toBe(40_000);
    expect(k.errors).toBe(1);
    expect(k.live).toBe(3);
    expect(k.visitors).toBe(1);
    expect(k.costUsd).toBeCloseTo(0.24);
  });
  it("has no rate or average when nothing finished", () => {
    expect(kpis([])).toMatchObject({ total: 0, approvalRate: null, avgMs: null, costUsd: 0 });
    expect(kpis([run({ status: "error" })]).approvalRate).toBeNull();
  });
});

describe("bucketRuns", () => {
  it("makes 24 hourly buckets ending with the current hour and places runs in them", () => {
    const buckets = bucketRuns([run({ at: NOW - 30 * 60_000 }), run({ at: NOW - 5 * HOUR, mode: "simulated" })], "24h", NOW);
    expect(buckets).toHaveLength(24);
    expect(buckets[23].counts.live).toBe(1);
    expect(buckets[18].counts.simulated).toBe(1);
    expect(buckets.reduce((s, b) => s + b.counts.live + b.counts.simulated, 0)).toBe(2);
  });
  it("ignores runs outside the range and sums cost", () => {
    const buckets = bucketRuns([run({ at: NOW - 30 * HOUR }), run({ costUsd: 0.5 }), run({ costUsd: 0.25 })], "24h", NOW);
    expect(buckets.reduce((s, b) => s + b.counts.live, 0)).toBe(2);
    expect(buckets[23].costUsd).toBeCloseTo(0.75);
  });
  it("uses 12 five-minute buckets for an hour and 7 daily buckets for a week", () => {
    expect(bucketRuns([], "1h", NOW)).toHaveLength(12);
    expect(bucketRuns([], "7d", NOW)).toHaveLength(7);
  });
});

describe("countBy and agentTimings", () => {
  it("counts by key", () => {
    expect(countBy([run(), run({ status: "error" }), run()], (r) => r.status)).toEqual({ approved: 2, error: 1 });
  });
  it("averages only over runs that include the agent", () => {
    const t = agentTimings([run({ agentMs: { story: 100, pm: 10 } }), run({ agentMs: { story: 300 } })]);
    expect(t.find((x) => x.agent === "story")).toMatchObject({ avgMs: 200, samples: 2 });
    expect(t.find((x) => x.agent === "pm")).toMatchObject({ avgMs: 10, samples: 1 });
    expect(t.find((x) => x.agent === "release")).toMatchObject({ avgMs: 0, samples: 0 });
    expect(t).toHaveLength(8);
  });
});

describe("sortRuns and paginate", () => {
  it("sorts either way without changing the input", () => {
    const input = [run({ ms: 3 }), run({ ms: 1 }), run({ ms: 2 })];
    expect(sortRuns(input, { key: "ms", dir: "asc" }).map((r) => r.ms)).toEqual([1, 2, 3]);
    expect(sortRuns(input, { key: "ms", dir: "desc" }).map((r) => r.ms)).toEqual([3, 2, 1]);
    expect(input.map((r) => r.ms)).toEqual([3, 1, 2]);
  });
  it("clamps the page into range", () => {
    const items = Array.from({ length: 25 }, (_, i) => i);
    expect(paginate(items, 3, 10)).toMatchObject({ page: 3, pages: 3, items: [20, 21, 22, 23, 24] });
    expect(paginate(items, 99, 10).page).toBe(3);
    expect(paginate(items, -4, 10).page).toBe(1);
    expect(paginate([], 1, 10)).toMatchObject({ page: 1, pages: 1, items: [] });
  });
});

describe("toCsv", () => {
  it("writes a header and quotes cells that need it", () => {
    const csv = toCsv([run({ request: 'Say "hi", please' })]).split("\n");
    expect(csv[0]).toMatch(/^time,request,mode,status,seconds/);
    expect(csv[1]).toContain('"Say ""hi"", please"');
  });
  it("defuses spreadsheet formulas", () => {
    expect(toCsv([run({ request: "=HYPERLINK(\"http://evil\")" })])).toContain("'=HYPERLINK");
  });
});
