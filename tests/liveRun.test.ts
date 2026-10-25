import { describe, expect, it } from "vitest";
import { applyEvent, startLive, toRun } from "@/lib/liveRun";
import type { FoundryEvent } from "@/lib/types";

const play = (events: [FoundryEvent, number][]) => events.reduce((s, [e, at]) => applyEvent(s, e, at), startLive("idea"));

const finished: [FoundryEvent, number][] = [
  [{ type: "mode", mode: "live" }, 0],
  [{ type: "start", agent: "researcher", round: 1, model: "m" }, 10],
  [{ type: "token", agent: "researcher", round: 1, text: "he" }, 20],
  [{ type: "token", agent: "researcher", round: 1, text: "llo" }, 30],
  [{ type: "usage", agent: "researcher", round: 1, inputTokens: 5, outputTokens: 5, costUsd: 0.01 }, 40],
  [{ type: "done", agent: "researcher", round: 1, ms: 35 }, 45],
  [{ type: "start", agent: "e2e", round: 1, model: "m" }, 50],
  [{ type: "done", agent: "e2e", round: 1, ms: 5 }, 55],
  [{ type: "verdict", gate: "e2e", round: 1, approved: false }, 56],
  [{ type: "finish", ms: 60, rounds: 1, approved: false }, 60],
];

describe("applyEvent", () => {
  it("builds steps from start, token, done and verdict events without mutating earlier state", () => {
    const initial = startLive("idea");
    const state = play(finished);
    expect(initial.steps).toEqual([]);
    const researcher = state.steps.find((s) => s.agent === "researcher")!;
    expect(researcher).toMatchObject({ text: "hello", status: "done", ms: 35, start: 10, end: 45 });
    expect(state.steps.find((s) => s.agent === "e2e")!.passed).toBe(false);
    expect(state.costUsd).toBeCloseTo(0.01);
    expect(state.mode).toBe("live");
  });

  it("keeps rounds apart", () => {
    const state = play([
      [{ type: "start", agent: "backend", round: 1, model: "m" }, 0],
      [{ type: "start", agent: "backend", round: 2, model: "m" }, 5],
      [{ type: "token", agent: "backend", round: 2, text: "x" }, 6],
    ]);
    expect(state.steps.map((s) => s.text)).toEqual(["", "x"]);
  });
});

describe("toRun", () => {
  it("turns a finished stream into a scrubbable run", () => {
    const run = toRun(play(finished), 100)!;
    expect(run.mode).toBe("live");
    expect(run.total).toBeGreaterThan(55);
    expect(run.costUsd).toBeCloseTo(0.01);
    expect(run.approved).toBe(false);
  });

  it("returns nothing when the stream ended without a finish event", () => {
    expect(toRun(play(finished.slice(0, 5)), 100)).toBeNull();
    const errored = play([[{ type: "error", message: "boom" }, 1]]);
    expect(errored.error).toBe("boom");
    expect(toRun(errored, 100)).toBeNull();
  });

  it("hides the cost of a simulation", () => {
    const sim = play([[{ type: "mode", mode: "simulated" }, 0], ...finished.slice(1)]);
    expect(toRun(sim, 100)!.costUsd).toBeUndefined();
  });
});
