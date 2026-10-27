import type { FoundryEvent } from "../types";
import type { EvalRun } from "./summarize";

/** Turns one run's events into a scored run. Only finished live runs count; null for anything else. */
export function collectRun(events: FoundryEvent[]): EvalRun | null {
  const mode = events.find((e) => e.type === "mode");
  if (!mode || mode.mode !== "live") return null;
  const done = events.find((e) => e.type === "finish");
  if (!done) return null;
  return { approved: done.approved, rounds: done.rounds, costUsd: done.costUsd ?? 0, ms: done.ms };
}
