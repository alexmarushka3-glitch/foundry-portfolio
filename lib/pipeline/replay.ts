import type { LiveRecording } from "../recorder/capture";
import type { Emit } from "../types";

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Server-side replay of a recorded live run, kept for API clients. The page itself replays recordings
 * in the browser. Events go out in order, each at its recorded time scaled by `pace` (0 skips the waits,
 * which tests use).
 */
export async function replayOnServer(rec: LiveRecording, emit: Emit, pace = 1): Promise<void> {
  const t0 = Date.now();
  emit({ type: "mode", mode: "replay" });
  for (const { at, event } of rec.events) {
    if (event.type === "mode") continue; // the replay announces itself, not the original mode
    const wait = at * pace - (Date.now() - t0);
    if (pace > 0 && wait > 0) await sleep(wait);
    emit(event);
  }
}
