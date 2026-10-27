import { applyEvent, startLive, toRun } from "./liveRun";
import type { LiveState } from "./liveRun";
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

let loaded: Promise<LiveRecording[]> | null = null;

/** Loads the recordings on demand, so their size never lands in the first page load. */
export function loadLiveRecordings(): Promise<LiveRecording[]> {
  loaded ??= import("./liveRecordings.json").then((m) => m.default.recordings as unknown as LiveRecording[]);
  return loaded;
}
