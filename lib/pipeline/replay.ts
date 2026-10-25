import { buildReplayRun, type Recording } from "../run";
import type { Emit } from "../types";

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Server-side replay of a recorded run, kept for API clients. The page itself replays recordings
 * in the browser. `pace` scales the waits (0 skips them, which tests use).
 */
export async function replayOnServer(rec: Recording, emit: Emit, pace = 1): Promise<void> {
  const run = buildReplayRun(rec);
  emit({ type: "mode", mode: "replay" });
  const t0 = Date.now();
  const byStart = [...run.steps].sort((a, b) => a.start - b.start);
  for (const s of byStart) {
    const wait = (s.start - (Date.now() - t0)) * pace;
    if (wait > 0) await sleep(wait);
    emit({ type: "start", agent: s.agent, round: s.round, model: s.model });
    const chunks = s.text.match(/.{1,8}/gs) ?? [];
    const span = Math.max(1, s.end - s.start);
    for (const c of chunks) {
      emit({ type: "token", agent: s.agent, round: s.round, text: c });
      if (pace > 0) await sleep((span / chunks.length) * pace);
    }
    emit({ type: "done", agent: s.agent, round: s.round, ms: s.ms });
    if (s.agent === "e2e") emit({ type: "verdict", gate: "e2e", round: s.round, approved: rec.e2eOk });
    if (s.agent === "validator") emit({ type: "verdict", gate: "validator", round: s.round, approved: rec.approved });
  }
  emit({ type: "finish", ms: rec.totalMs, rounds: rec.rounds, approved: rec.approved });
}
