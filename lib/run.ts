import recordings from "./recordings.json";
import { AGENT_LIST } from "./agents";
import type { AgentName, Mode } from "./types";

// Safe to import in the browser and on the server: no Node-only code.

export type Recording = (typeof recordings.examples)[number];

const normalize = (s: string) => s.trim().toLowerCase().replace(/[.!?]+$/, "");

export function findRecording(request: string): Recording | undefined {
  return recordings.examples.find((e) => normalize(e.request) === normalize(request));
}

export const EXAMPLE_REQUESTS: string[] = recordings.examples.map((e) => e.request);

/** A picture taken by the real browser during the E2E step. */
export type Shot = { label: string; png: string };

/** One agent's work in one round, placed on a timeline (milliseconds on the playback clock). */
export type Step = {
  agent: AgentName;
  round: number;
  model: string;
  text: string;
  start: number;
  end: number;
  /** Real wall-clock time this agent took, for display. */
  ms: number;
  passed?: boolean;
  shots?: Shot[];
};

export type Run = {
  request: string;
  mode: Mode;
  steps: Step[];
  /** Length of the playback timeline. */
  total: number;
  approved: boolean;
  rounds: number;
  /** Real time the whole run took. */
  realMs: number;
  costUsd?: number;
};

/** What the stage draws for one agent at one moment. */
export type StepView = {
  agent: AgentName;
  round: number;
  model: string;
  text: string;
  status: "active" | "done";
  ms?: number;
  passed?: boolean;
  shots?: Shot[];
};

export type AgentFrame = {
  agent: AgentName;
  status: "pending" | "active" | "done";
  round: number;
  model?: string;
  text: string;
  ms?: number;
  passed?: boolean;
  shots?: Shot[];
};

const GAP = 450; // pause between stages on the playback clock
const TAIL = 700;
// Replays compress real time. A stage plays for 12% of the time it really took, within bounds.
const stageMs = (real: number) => Math.min(3200, Math.max(900, real * 0.12));

/** Lay a recorded run out on a playback timeline. Backend and Frontend start together. */
export function buildReplayRun(rec: Recording): Run {
  const byAgent = Object.fromEntries(rec.steps.map((s) => [s.agent, s])) as Record<AgentName, Recording["steps"][number]>;
  const steps: Step[] = [];
  let t = 0;

  const place = (agents: AgentName[]) => {
    const durations = agents.map((a) => stageMs(byAgent[a].ms));
    const end = t + Math.max(...durations);
    agents.forEach((a, i) => {
      const s = byAgent[a];
      steps.push({
        agent: a,
        round: s.round,
        model: s.model,
        text: s.text,
        start: t,
        end: t + durations[i],
        ms: s.ms,
        passed: a === "e2e" ? rec.e2eOk : a === "validator" ? rec.approved : undefined,
      });
    });
    t = end + GAP;
  };

  place(["researcher"]);
  place(["story"]);
  place(["pm"]);
  place(["backend", "frontend"]);
  place(["e2e"]);
  place(["validator"]);
  place(["release"]);

  return {
    request: rec.request,
    mode: "replay",
    steps,
    total: t - GAP + TAIL,
    approved: rec.approved,
    rounds: rec.rounds,
    realMs: rec.totalMs,
  };
}

/** Everything that has started by time t, with text revealed in proportion to progress. */
export function viewsAt(run: Run, t: number): StepView[] {
  const views: StepView[] = [];
  for (const s of run.steps) {
    if (t < s.start) continue;
    if (t >= s.end) {
      views.push({ agent: s.agent, round: s.round, model: s.model, text: s.text, status: "done", ms: s.ms, passed: s.passed, shots: s.shots });
    } else {
      const p = (t - s.start) / Math.max(1, s.end - s.start);
      views.push({ agent: s.agent, round: s.round, model: s.model, text: s.text.slice(0, Math.floor(s.text.length * p)), status: "active" });
    }
  }
  return views;
}

/** One frame per agent. If an agent ran in two rounds, the latest round that has started wins. */
export function framesFrom(views: StepView[]): AgentFrame[] {
  return AGENT_LIST.map((a) => {
    const mine = views.filter((v) => v.agent === a.id).sort((x, y) => y.round - x.round)[0];
    if (!mine) return { agent: a.id, status: "pending", round: 0, text: "" };
    return { agent: a.id, status: mine.status, round: mine.round, model: mine.model, text: mine.text, ms: mine.ms, passed: mine.passed, shots: mine.shots };
  });
}

export const maxRound = (views: StepView[]) => views.reduce((m, v) => Math.max(m, v.round), 0);
