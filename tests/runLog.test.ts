import { describe, expect, it } from "vitest";
import { RunLog, createRecorder, hashVisitor, type RunRecord } from "@/lib/server/runLog";

const record = (over: Partial<RunRecord> = {}): RunRecord => ({
  id: crypto.randomUUID(),
  at: 0,
  request: "idea",
  mode: "simulated",
  status: "approved",
  ms: 1000,
  rounds: 1,
  costUsd: 0,
  inputTokens: 0,
  outputTokens: 0,
  agentMs: {},
  visitor: "abc",
  ...over,
});

describe("RunLog", () => {
  it("lists newest first and drops the oldest past its capacity", () => {
    const log = new RunLog(3);
    [1, 2, 3, 4].forEach((at) => log.add(record({ at })));
    expect(log.list().map((r) => r.at)).toEqual([4, 3, 2]);
  });
  it("clears and says how many it dropped", () => {
    const log = new RunLog();
    log.add(record());
    log.add(record());
    expect(log.clear()).toBe(2);
    expect(log.list()).toEqual([]);
  });
});

describe("hashVisitor", () => {
  it("is stable, short, and does not contain the address", () => {
    expect(hashVisitor("203.0.113.9")).toBe(hashVisitor("203.0.113.9"));
    expect(hashVisitor("203.0.113.9")).toHaveLength(8);
    expect(hashVisitor("203.0.113.9")).not.toContain("203");
  });
});

describe("createRecorder", () => {
  it("builds a record from the events of a finished live run", () => {
    let t = 1000;
    const rec = createRecorder({ request: "idea", visitor: "v", now: () => t });
    rec.observe({ type: "mode", mode: "live" });
    rec.observe({ type: "done", agent: "story", round: 1, ms: 40 });
    rec.observe({ type: "done", agent: "story", round: 2, ms: 60 });
    rec.observe({ type: "usage", agent: "story", round: 1, inputTokens: 10, outputTokens: 5, costUsd: 0.01 });
    rec.observe({ type: "usage", agent: "pm", round: 1, inputTokens: 20, outputTokens: 5, costUsd: 0.02 });
    rec.observe({ type: "finish", ms: 500, rounds: 2, approved: true });
    t = 3500;
    const r = rec.close();
    expect(r).toMatchObject({ mode: "live", status: "approved", rounds: 2, ms: 2500, inputTokens: 30, outputTokens: 10 });
    expect(r.costUsd).toBeCloseTo(0.03);
    expect(r.agentMs.story).toBe(100);
  });

  it("marks a run that finished without approval, an error, and a visitor who left", () => {
    const notApproved = createRecorder({ request: "x", visitor: "v" });
    notApproved.observe({ type: "finish", ms: 1, rounds: 2, approved: false });
    expect(notApproved.close().status).toBe("not-approved");

    const failed = createRecorder({ request: "x", visitor: "v" });
    failed.observe({ type: "error", message: "boom" });
    expect(failed.close()).toMatchObject({ status: "error", error: "boom" });

    const left = createRecorder({ request: "x", visitor: "v" });
    left.observe({ type: "start", agent: "story", round: 1, model: "m" });
    expect(left.close(true).status).toBe("cancelled");
  });

  it("does not call a finished run cancelled just because the connection then closed", () => {
    const rec = createRecorder({ request: "x", visitor: "v" });
    rec.observe({ type: "finish", ms: 1, rounds: 1, approved: true });
    expect(rec.close(true).status).toBe("approved");
  });
});
