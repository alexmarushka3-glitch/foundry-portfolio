import { describe, expect, it } from "vitest";
import { buildLiveReplayRun, findLiveRecording } from "../lib/liveReplay";
import { framesFrom, viewsAt } from "../lib/run";
import type { LiveRecording, TimedEvent } from "../lib/recorder/capture";
import type { AgentName, FoundryEvent } from "../lib/types";

const ev = (at: number, event: FoundryEvent): TimedEvent => ({ at, event });

// Two rounds: validator sends it back once, then everything passes in round 2.
function recording(): LiveRecording {
  const events: TimedEvent[] = [ev(0, { type: "mode", mode: "live" })];
  let t = 100;
  const stage = (agent: AgentName, round: number, ms: number) => {
    events.push(ev(t, { type: "start", agent, round, model: "m" }));
    events.push(ev(t + 10, { type: "token", agent, round, text: `${agent} r${round}` }));
    t += ms;
    events.push(ev(t, { type: "done", agent, round, ms }));
    events.push(ev(t, { type: "usage", agent, round, inputTokens: 1, outputTokens: 1, costUsd: 0.01 }));
    t += 5;
  };
  const r1: AgentName[] = ["researcher", "story", "pm", "backend", "frontend", "e2e", "validator"];
  for (const a of r1) stage(a, 1, 4000);
  events.push(ev(t, { type: "verdict", gate: "e2e", round: 1, approved: true }));
  events.push(ev(t, { type: "verdict", gate: "validator", round: 1, approved: false }));
  for (const a of ["backend", "frontend", "e2e", "validator"] as AgentName[]) stage(a, 2, 3000);
  events.push(ev(t, { type: "verdict", gate: "e2e", round: 2, approved: true }));
  events.push(ev(t, { type: "verdict", gate: "validator", round: 2, approved: true }));
  stage("release", 1, 20); // short on purpose: must still get a minimum length
  events.push(ev(t, { type: "finish", ms: t, rounds: 2, approved: true }));
  return {
    slug: "demo",
    request: "Add due dates to tasks",
    recordedAt: "2026-10-27T00:00:00.000Z",
    events,
    approved: true,
    rounds: 2,
    totalMs: t,
    costUsd: 0.16,
  };
}

describe("buildLiveReplayRun", () => {
  const rec = recording();
  const run = buildLiveReplayRun(rec);

  it("is a replay of a live run", () => {
    expect(run.mode).toBe("replay");
    expect(run.source).toBe("live-run");
    expect(run.costUsd).toBeCloseTo(0.16, 5);
    expect(run.pr).toBeUndefined();
    expect(run.approved).toBe(true);
    expect(run.rounds).toBe(2);
  });

  it("is shorter than the real run but not empty", () => {
    expect(run.total).toBeGreaterThan(0);
    expect(run.total).toBeLessThan(rec.totalMs);
  });

  it("puts round 2 after round 1 ends", () => {
    const r1End = Math.max(...run.steps.filter((s) => s.round === 1 && s.agent === "validator").map((s) => s.end));
    for (const s of run.steps.filter((s) => s.round === 2)) expect(s.start).toBeGreaterThanOrEqual(r1End);
  });

  it("gives every step at least 900 ms", () => {
    for (const s of run.steps) expect(s.end - s.start).toBeGreaterThanOrEqual(900);
  });

  it("shows a done frame per agent with passed flags at the end", () => {
    const frames = framesFrom(viewsAt(run, run.total));
    expect(frames.every((f) => f.status === "done")).toBe(true);
    expect(frames.find((f) => f.agent === "e2e")?.passed).toBe(true);
    expect(frames.find((f) => f.agent === "validator")?.passed).toBe(true);
  });
});

describe("findLiveRecording", () => {
  const recs = [recording()];
  it("ignores case, spacing and trailing punctuation", () => {
    expect(findLiveRecording(recs, "  add due dates to tasks!! ")).toBe(recs[0]);
  });
  it("returns undefined when nothing matches", () => {
    expect(findLiveRecording(recs, "something else")).toBeUndefined();
  });
});
