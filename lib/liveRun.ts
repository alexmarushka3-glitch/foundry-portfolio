import type { Run, Step, StepView } from "./run";
import type { FoundryEvent, Mode } from "./types";

// Client-side model of a run that is still streaming in. Pure functions, so the UI hook stays thin
// and the behaviour can be tested without a browser.

export type LiveStep = StepView & { start: number; end?: number };

export type LiveState = {
  request: string;
  mode: Mode | null;
  reason?: string;
  steps: LiveStep[];
  costUsd: number;
  pr?: { url: string; number: number };
  /** Set when the server sent its closing "finish" event. */
  result?: { approved: boolean; rounds: number; realMs: number };
  /** Set when the server sent an "error" event. */
  error?: string;
};

export const startLive = (request: string): LiveState => ({ request, mode: null, steps: [], costUsd: 0 });

const sameStep = (s: LiveStep, agent: string, round: number) => s.agent === agent && s.round === round;

/** Apply one server event. `at` is when it arrived, in ms since the run started. */
export function applyEvent(state: LiveState, e: FoundryEvent, at: number): LiveState {
  switch (e.type) {
    case "mode":
      return { ...state, mode: e.mode, reason: e.reason };
    case "start":
      return {
        ...state,
        steps: [...state.steps, { agent: e.agent, round: e.round, model: e.model, text: "", status: "active", start: at }],
      };
    case "token":
      return { ...state, steps: state.steps.map((s) => (sameStep(s, e.agent, e.round) ? { ...s, text: s.text + e.text } : s)) };
    case "tool":
      return {
        ...state,
        steps: state.steps.map((s) =>
          sameStep(s, e.agent, e.round)
            ? { ...s, text: `${s.text}${s.text && !s.text.endsWith("\n") ? "\n" : ""}› ${e.label}${e.ok ? "" : " (failed)"}\n` }
            : s,
        ),
      };
    case "shot":
      return {
        ...state,
        steps: state.steps.map((s) =>
          sameStep(s, e.agent, e.round) ? { ...s, shots: [...(s.shots ?? []), { label: e.label, png: e.png }] } : s,
        ),
      };
    case "done":
      return {
        ...state,
        steps: state.steps.map((s) => (sameStep(s, e.agent, e.round) ? { ...s, status: "done", ms: e.ms, end: at } : s)),
      };
    case "usage":
      return { ...state, costUsd: state.costUsd + e.costUsd };
    case "verdict":
      return { ...state, steps: state.steps.map((s) => (sameStep(s, e.gate, e.round) ? { ...s, passed: e.approved } : s)) };
    case "pr":
      return { ...state, pr: { url: e.url, number: e.number } };
    case "finish":
      return { ...state, result: { approved: e.approved, rounds: e.rounds, realMs: e.ms } };
    case "error":
      return { ...state, error: e.message };
  }
}

const TAIL_MS = 700;

/** Turn a finished stream into a run that can be scrubbed, using the times events really arrived. */
export function toRun(state: LiveState, now: number): Run | null {
  if (!state.result || state.steps.length === 0) return null;
  const steps: Step[] = state.steps.map((s) => ({
    agent: s.agent,
    round: s.round,
    model: s.model,
    text: s.text,
    start: s.start,
    end: s.end ?? now,
    ms: s.ms ?? 0,
    passed: s.passed,
    shots: s.shots,
  }));
  const mode = state.mode ?? "simulated";
  return {
    request: state.request,
    mode,
    steps,
    total: Math.max(...steps.map((s) => s.end)) + TAIL_MS,
    approved: state.result.approved,
    rounds: state.result.rounds,
    realMs: state.result.realMs,
    costUsd: mode === "live" ? state.costUsd : undefined,
    pr: state.pr,
  };
}
