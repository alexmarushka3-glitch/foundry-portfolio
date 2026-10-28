import { describe, expect, it, vi } from "vitest";
import type { LiveRecording } from "@/lib/recorder/capture";

describe("loadLiveRecordings", () => {
  it("retries after a failed load instead of remembering the failure", async () => {
    vi.resetModules();
    const { loadLiveRecordings } = await import("@/lib/liveReplay");
    const good: LiveRecording[] = [];
    await expect(loadLiveRecordings(() => Promise.reject(new Error("chunk failed")))).rejects.toThrow(/chunk failed/);
    const ok = vi.fn(() => Promise.resolve(good));
    await expect(loadLiveRecordings(ok)).resolves.toBe(good);
    await loadLiveRecordings(ok);
    expect(ok).toHaveBeenCalledTimes(1); // a success is remembered
  });
});
