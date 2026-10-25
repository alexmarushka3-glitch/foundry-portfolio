import { describe, expect, it } from "vitest";
import { agentTimings, bucketRuns, filterRuns, DEFAULT_FILTERS, kpis } from "@/lib/admin/aggregate";
import { SAMPLE_VISITOR_PREFIX, sampleOverview, sampleRuns } from "@/lib/admin/sampleData";
import { AGENT_LIST } from "@/lib/agents";

const NOW = Date.UTC(2026, 9, 25, 15, 0, 0);

describe("sample data", () => {
  const runs = sampleRuns(NOW);

  it("is repeatable for the same clock and seed", () => {
    expect(sampleRuns(NOW)).toEqual(runs);
    expect(sampleRuns(NOW, 8)).not.toEqual(runs);
  });

  it("can never be mistaken for real visitors: every visitor and run id says sample", () => {
    expect(runs.every((r) => r.visitor.startsWith(SAMPLE_VISITOR_PREFIX))).toBe(true);
    expect(runs.every((r) => r.id.startsWith("sample-run-"))).toBe(true);
  });

  it("is newest first, inside the last seven days, with some runs in the last hour", () => {
    expect(runs.map((r) => r.at)).toEqual([...runs.map((r) => r.at)].sort((a, b) => b - a));
    expect(runs.every((r) => NOW - r.at >= 0 && NOW - r.at <= 7 * 86_400_000)).toBe(true);
    expect(runs.filter((r) => NOW - r.at <= 3_600_000).length).toBeGreaterThan(0);
  });

  it("is internally consistent: only live runs cost money, errors say why, agents are real", () => {
    const agents = new Set(AGENT_LIST.map((a) => a.id));
    for (const r of runs) {
      if (r.mode !== "live") expect(r.costUsd).toBe(0);
      if (r.status === "error") expect(r.error).toBeTruthy();
      expect(r.ms).toBeGreaterThan(0);
      for (const agent of Object.keys(r.agentMs)) expect(agents.has(agent as never)).toBe(true);
    }
  });

  it("fills every part of the dashboard, so no chart or card is empty", () => {
    const k = kpis(runs);
    expect(k.live).toBeGreaterThan(0);
    expect(k.approvalRate).toBeGreaterThan(0.4);
    expect(k.errors).toBeGreaterThan(0);
    expect(k.costUsd).toBeGreaterThan(0);
    expect(bucketRuns(runs, "7d", NOW).filter((b) => Object.values(b.counts).some(Boolean)).length).toBeGreaterThan(2);
    expect(agentTimings(runs).every((t) => t.avgMs > 0)).toBe(true);
    expect(filterRuns(runs, DEFAULT_FILTERS, NOW).length).toBeGreaterThan(5);
  });

  it("builds a full overview with the real recorded examples", () => {
    const o = sampleOverview(NOW);
    expect(o.recorded).toHaveLength(3);
    expect(o.server.limits.usedToday).toBeLessThanOrEqual(o.server.limits.perDay);
    expect(o.server.liveEnabled).toBe(true);
  });
});
