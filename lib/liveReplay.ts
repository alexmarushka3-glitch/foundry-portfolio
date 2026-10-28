import { applyEvent, startLive, toRun } from "./liveRun";
import type { LiveState } from "./liveRun";
import { RECORDING_CHUNKS } from "./liveRecordingChunks";
import type { LiveRecording } from "./recorder/capture";
import { normalizeRequest, type Run } from "./run";

// Safe in the browser and on the server. A replay folds the recorded events through the same reducer
// the live stream uses, with their times compressed, so the two paths cannot drift apart.

export const TIME_SCALE = 0.2;
export const MIN_STEP_MS = 900;

export function buildLiveReplayRun(rec: LiveRecording): Run {
  let state: LiveState = startLive(rec.request);
  let shift = 0; // extra time added so short steps still last long enough to watch
  let last = 0;
  for (const { at, event } of rec.events) {
    let t = Math.max(last, at * TIME_SCALE + shift);
    if (event.type === "done") {
      const step = state.steps.find((s) => s.agent === event.agent && s.round === event.round);
      if (step && t - step.start < MIN_STEP_MS) {
        shift += step.start + MIN_STEP_MS - t;
        t = step.start + MIN_STEP_MS;
      }
    }
    last = t;
    state = applyEvent(state, event, t);
  }
  const run = toRun(state, last);
  if (!run) throw new Error(`Recording ${rec.slug} is incomplete: no finish event or no steps.`);
  return { ...run, mode: "replay", source: "live-run", costUsd: rec.costUsd, pr: undefined };
}

export function findLiveRecording(recs: LiveRecording[], request: string): LiveRecording | undefined {
  return recs.find((r) => normalizeRequest(r.request) === normalizeRequest(request));
}

type Chunk = { request: string; load: () => Promise<{ default: unknown }> };

const loaded = new Map<string, Promise<LiveRecording>>();

/**
 * Loads the one recording that matches `request`, on demand, so no recording lands in the first page load
 * and playing one example never downloads the others. Resolves undefined if the request isn't a recorded one.
 */
export async function loadLiveRecording(request: string, chunks: Chunk[] = RECORDING_CHUNKS): Promise<LiveRecording | undefined> {
  const key = normalizeRequest(request);
  const chunk = chunks.find((c) => normalizeRequest(c.request) === key);
  if (!chunk) return undefined;
  let attempt = loaded.get(key);
  if (!attempt) {
    const next = chunk.load().then((m) => m.default as LiveRecording);
    loaded.set(key, next);
    // A failed load must not be remembered, or every later call would fail too.
    next.catch(() => {
      if (loaded.get(key) === next) loaded.delete(key);
    });
    attempt = next;
  }
  return attempt;
}
