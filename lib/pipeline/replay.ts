import type { LiveRecording } from "../recorder/capture";
import type { Emit } from "../types";

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (!signal) return sleep(ms);
  return new Promise<void>((resolve) => {
    const done = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal.addEventListener("abort", done);
  });
}

/**
 * Server-side replay of a recorded live run, kept for API clients. The page itself replays recordings
 * in the browser. Events go out in order, each at its recorded time scaled by `pace` (0 skips the waits,
 * which tests use).
 */
export async function replayOnServer(rec: LiveRecording, emit: Emit, pace = 1, signal?: AbortSignal): Promise<void> {
  const t0 = Date.now();
  emit({ type: "mode", mode: "replay" });
  for (const { at, event } of rec.events) {
    if (signal?.aborted) return;
    // The replay announces itself, opens no pull request and spends nothing, so recorded usage is not re-emitted.
    if (event.type === "mode" || event.type === "pr" || event.type === "usage") continue;
    const wait = at * pace - (Date.now() - t0);
    if (pace > 0 && wait > 0) await abortableSleep(wait, signal);
    if (signal?.aborted) return;
    emit(event);
  }
}
