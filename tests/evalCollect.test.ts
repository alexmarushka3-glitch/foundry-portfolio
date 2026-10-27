import { describe, expect, it } from "vitest";
import { collectRun } from "@/lib/eval/collect";
import type { FoundryEvent } from "@/lib/types";

const live: FoundryEvent = { type: "mode", mode: "live" };
const finish = (over: Partial<Extract<FoundryEvent, { type: "finish" }>> = {}): FoundryEvent => ({
  type: "finish",
  ms: 41_000,
  rounds: 2,
  approved: true,
  costUsd: 0.12,
  ...over,
});

describe("collectRun", () => {
  it("scores a finished live run from its finish event", () => {
    expect(collectRun([live, finish()])).toEqual({ approved: true, rounds: 2, costUsd: 0.12, ms: 41_000 });
  });

  it("does not count a simulation, so made-up text can never raise the success rate", () => {
    expect(collectRun([{ type: "mode", mode: "simulated" }, finish()])).toBeNull();
  });

  it("does not count a replay of a recording", () => {
    expect(collectRun([{ type: "mode", mode: "replay" }, finish()])).toBeNull();
  });

  it("does not count a run that never finished, such as one that errored", () => {
    expect(collectRun([live, { type: "error", message: "boom" }])).toBeNull();
  });

  it("counts a finished live run that was not approved, so failures stay in the rate", () => {
    expect(collectRun([live, finish({ approved: false })])?.approved).toBe(false);
  });

  it("treats a missing cost as zero rather than dropping the run", () => {
    expect(collectRun([live, finish({ costUsd: undefined })])?.costUsd).toBe(0);
  });
});
