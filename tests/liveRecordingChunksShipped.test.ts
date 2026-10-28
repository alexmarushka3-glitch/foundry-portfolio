import { describe, expect, it } from "vitest";
import liveRecordings from "@/lib/liveRecordings.json";
import { RECORDING_CHUNKS } from "@/lib/liveRecordingChunks";

describe("shipped per-example recording chunks", () => {
  it("hold exactly the recordings in lib/liveRecordings.json, one each, unchanged", async () => {
    const all = liveRecordings.recordings as { request: string }[];
    expect(RECORDING_CHUNKS.map((c) => c.request)).toEqual(all.map((r) => r.request));
    for (const [i, chunk] of RECORDING_CHUNKS.entries()) {
      expect((await chunk.load()).default).toEqual(all[i]);
    }
  });
});
