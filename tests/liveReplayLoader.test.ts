import { describe, expect, it, vi } from "vitest";
import type { LiveRecording } from "@/lib/recorder/capture";

describe("loadLiveRecording", () => {
  it("retries after a failed load instead of remembering the failure", async () => {
    vi.resetModules();
    const { loadLiveRecording } = await import("@/lib/liveReplay");
    const good = { slug: "x", request: "Add due dates" } as unknown as LiveRecording;
    const failing = [{ request: "Add due dates", load: () => Promise.reject(new Error("chunk failed")) }];
    await expect(loadLiveRecording("add due dates", failing)).rejects.toThrow(/chunk failed/);
    const load = vi.fn(() => Promise.resolve({ default: good }));
    const ok = [{ request: "Add due dates", load }];
    await expect(loadLiveRecording("Add due dates!", ok)).resolves.toBe(good);
    await loadLiveRecording("Add due dates", ok);
    expect(load).toHaveBeenCalledTimes(1); // a success is remembered
  });

  it("loads only the matching example and nothing for an unknown request", async () => {
    vi.resetModules();
    const { loadLiveRecording } = await import("@/lib/liveReplay");
    const a = vi.fn(() => Promise.resolve({ default: { slug: "a" } }));
    const b = vi.fn(() => Promise.resolve({ default: { slug: "b" } }));
    const chunks = [
      { request: "First example", load: a },
      { request: "Second example", load: b },
    ];
    expect(await loadLiveRecording("Second example", chunks)).toEqual({ slug: "b" });
    expect(await loadLiveRecording("something else", chunks)).toBeUndefined();
    expect(a).not.toHaveBeenCalled();
  });
});
