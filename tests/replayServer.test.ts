import { describe, expect, it } from "vitest";
import { replayOnServer } from "@/lib/pipeline/replay";
import type { FoundryEvent } from "@/lib/types";
import { fixtureRecording } from "./fixtures/liveRecording";

describe("replayOnServer", () => {
  it("stops emitting when the signal aborts, without sleeping through the recording", async () => {
    const rec = fixtureRecording();
    const ctrl = new AbortController();
    const events: FoundryEvent[] = [];
    const started = Date.now();
    await replayOnServer(rec, (e) => { events.push(e); if (e.type === "start") ctrl.abort(); }, 1, ctrl.signal);
    expect(Date.now() - started).toBeLessThan(1000);
    expect(events.at(-1)?.type).toBe("start");
    expect(events.some((e) => e.type === "finish")).toBe(false);
  });

  it("never emits a pr event", async () => {
    const rec = fixtureRecording();
    rec.events.splice(3, 0, { at: 200, event: { type: "pr", url: "https://example.com/pr/1", number: 1 } });
    const events: FoundryEvent[] = [];
    await replayOnServer(rec, (e) => events.push(e), 0);
    expect(events.some((e) => e.type === "pr")).toBe(false);
    expect(events.at(-1)?.type).toBe("finish");
  });
});
