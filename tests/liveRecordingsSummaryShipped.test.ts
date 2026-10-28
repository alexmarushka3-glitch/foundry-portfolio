import { describe, expect, it } from "vitest";
import liveRecordings from "@/lib/liveRecordings.json";
import summary from "@/lib/liveRecordingsSummary.json";
import type { LiveRecording } from "@/lib/recorder/capture";

describe("shipped recordings summary", () => {
  it("matches what the shipped recordings produce", () => {
    const expected = (liveRecordings.recordings as unknown as LiveRecording[]).map((r) => ({
      request: r.request,
      rounds: r.rounds,
      approved: r.approved,
      totalMs: r.totalMs,
      models: [...new Set(r.events.flatMap((e) => (e.event.type === "start" ? [e.event.model] : [])))],
      costUsd: r.events.reduce((sum, e) => sum + (e.event.type === "usage" ? e.event.costUsd : 0), 0),
    }));
    expect(summary).toEqual(expected);
  });
});
