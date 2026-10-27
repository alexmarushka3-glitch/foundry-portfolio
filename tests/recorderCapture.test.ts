import { describe, expect, it } from "vitest";
import { assertRecordingSize, captureRun } from "../lib/recorder/capture";
import type { Emit } from "../lib/types";

function clock(...times: number[]) {
  let i = 0;
  return () => times[Math.min(i++, times.length - 1)];
}

const good = async (emit: Emit) => {
  emit({ type: "mode", mode: "live" });
  emit({ type: "start", agent: "researcher", round: 1, model: "m" });
  emit({ type: "token", agent: "researcher", round: 1, text: "hi" });
  emit({ type: "usage", agent: "researcher", round: 1, inputTokens: 1, outputTokens: 1, costUsd: 0.01 });
  emit({ type: "usage", agent: "validator", round: 1, inputTokens: 1, outputTokens: 1, costUsd: 0.02 });
  emit({ type: "done", agent: "researcher", round: 1, ms: 5 });
  emit({ type: "verdict", gate: "validator", round: 1, approved: true });
  emit({ type: "finish", ms: 900, rounds: 1, approved: true });
};

describe("captureRun", () => {
  it("records timed events and the outcome", async () => {
    // start time, then one reading per event (8 events)
    const rec = await captureRun("s", "req", good, clock(1000, 1000, 1010, 1020, 1030, 1040, 1050, 1060, 1900));
    expect(rec.slug).toBe("s");
    expect(rec.request).toBe("req");
    expect(rec.approved).toBe(true);
    expect(rec.rounds).toBe(1);
    expect(rec.events).toHaveLength(8);
    expect(rec.events[0].at).toBe(0);
    const ats = rec.events.map((e) => e.at);
    expect([...ats].sort((a, b) => a - b)).toEqual(ats);
    expect(rec.costUsd).toBeCloseTo(0.03);
    expect(rec.totalMs).toBe(900);
    expect(typeof rec.recordedAt).toBe("string");
  });

  it("rejects when there is no finish event", async () => {
    await expect(
      captureRun("s", "r", async (emit) => {
        emit({ type: "mode", mode: "live" });
      }),
    ).rejects.toThrow(/finish/);
  });

  it("rejects when the first mode is not live", async () => {
    await expect(
      captureRun("s", "r", async (emit) => {
        emit({ type: "mode", mode: "simulated" });
        emit({ type: "finish", ms: 1, rounds: 1, approved: true });
      }),
    ).rejects.toThrow(/live/);
  });

  it("rejects when an event contains a secret", async () => {
    await expect(
      captureRun("s", "r", async (emit) => {
        emit({ type: "mode", mode: "live" });
        emit({ type: "token", agent: "researcher", round: 1, text: "key sk-ant-abc123" });
        emit({ type: "finish", ms: 1, rounds: 1, approved: true });
      }),
    ).rejects.toThrow(/secret/);
  });
});

describe("assertRecordingSize", () => {
  it("throws over 1.5 million characters", () => {
    expect(() => assertRecordingSize("x".repeat(1_500_001))).toThrow();
    expect(() => assertRecordingSize("x".repeat(1_500_000))).not.toThrow();
  });
});
