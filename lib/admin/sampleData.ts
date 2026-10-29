import type { AdminOverview } from "./overview";
import { recordedExamples } from "./recorded";
import type { RunRecord, RunStatus } from "../server/runLog";
import type { AgentName, Mode } from "../types";

// MADE-UP DATA for the public /admin-demo page. None of this describes real visitors, runs or spend.
// It is generated (not stored) from a fixed seed, so the page looks the same on every visit apart from the clock.
// The recorded examples shown on the page are the real ones from lib/liveRecordings.json.

/** Every visitor id in the sample data starts with this, so it can't be mistaken for a real hash. */
export const SAMPLE_VISITOR_PREFIX = "sample-";

const IDEAS = [
  "Add a nickname to each task",
  "Let users add notes to a task",
  "Show a count of unfinished tasks",
  "Add a delete button with an undo",
  "Let users sort tasks by due date",
  "Add a completed-on date when a task is checked off",
  "Add tags to tasks",
  "Let users pin a task to the top",
  "Add a daily reminder for overdue tasks",
  "Let users duplicate a task",
  "Add a dark mode toggle",
  "Group tasks by project",
];

/** Rough time each agent takes, in ms: the average of the three recorded live runs, rounded. */
const AGENT_BASE_MS: Record<AgentName, number> = {
  researcher: 5300,
  story: 3600,
  pm: 5400,
  backend: 27300,
  frontend: 17800,
  e2e: 22300,
  validator: 3600,
  release: 2100,
};

/** The site's default live limits (lib/server/state.ts), so the sample doesn't show more than the real site allows. */
const SAMPLE_LIMITS = { perHour: 1, perDay: 8 };

/** The scripted simulation finishes in a few seconds, not a minute. */
const SIMULATED_SPEED = 0.08;

/** A small seeded random number generator (mulberry32), so the sample is repeatable. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rand: () => number, weighted: [T, number][]): T {
  const total = weighted.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [value, w] of weighted) {
    if ((r -= w) < 0) return value;
  }
  return weighted[weighted.length - 1][0];
}

const HOUR = 3_600_000;

/** About 70 made-up runs over the last 7 days, newest first, with a few in the last hour. */
export function sampleRuns(now: number, seed = 7): RunRecord[] {
  const rand = rng(seed);
  const runs: RunRecord[] = [];
  const COUNT = 70;
  let liveToday = 0;
  for (let i = 0; i < COUNT; i++) {
    // Bias toward recent: the first dozen fall in the last day, a few in the last hour.
    const age = i < 4 ? rand() * HOUR : i < 22 ? rand() * 24 * HOUR : rand() * 7 * 24 * HOUR;
    let mode = pick<Mode>(rand, [["live", 45], ["simulated", 45], ["replay", 10]]);
    // Past the daily limit, a request falls back to the simulation, as it does on the site.
    if (mode === "live" && age < 24 * HOUR && ++liveToday > SAMPLE_LIMITS.perDay) mode = "simulated";
    const status = pick<RunStatus>(rand, [["approved", 70], ["not-approved", 9], ["error", 8], ["cancelled", 13]]);
    const rounds = status === "error" || status === "cancelled" ? 0 : rand() < 0.3 ? 2 : 1;
    const agentMs: Partial<Record<AgentName, number>> = {};
    let ms = 0;
    if (status !== "error") {
      const cut = status === "cancelled" ? Math.ceil(rand() * 5) : 8;
      (Object.keys(AGENT_BASE_MS) as AgentName[]).slice(0, cut).forEach((agent) => {
        const factor = 0.7 + rand() * 0.7;
        const rep = rounds === 2 && ["backend", "frontend", "e2e", "validator"].includes(agent) ? 2 : 1;
        agentMs[agent] = Math.round(AGENT_BASE_MS[agent] * factor * rep * (mode === "simulated" ? SIMULATED_SPEED : 1));
        ms += agentMs[agent]!;
      });
      ms = Math.round(ms * 0.82); // backend and frontend overlap
    } else {
      ms = Math.round(5000 + rand() * 40_000);
    }
    const live = mode === "live";
    const costUsd = live && status !== "error" ? +(0.17 + rand() * 0.05 + (rounds === 2 ? 0.03 : 0)).toFixed(4) : 0;
    runs.push({
      id: `sample-run-${String(i).padStart(2, "0")}`,
      at: Math.round(now - age),
      request: IDEAS[Math.floor(rand() * IDEAS.length)],
      mode,
      status,
      ms,
      rounds,
      costUsd,
      inputTokens: live ? Math.round(costUsd * 130_000) : 0,
      outputTokens: live ? Math.round(costUsd * 45_000) : 0,
      agentMs,
      error: status === "error" ? "The run stopped before it finished. Try again in a moment." : undefined,
      visitor: `${SAMPLE_VISITOR_PREFIX}${String(1 + Math.floor(rand() * 14)).padStart(2, "0")}`,
    });
  }
  return runs.sort((a, b) => b.at - a.at);
}

/** The whole dashboard payload with sample runs. The settings are plausible defaults, not this site's real ones. */
export function sampleOverview(now: number = Date.now(), seed = 7): AdminOverview {
  const runs = sampleRuns(now, seed);
  const usedToday = runs.filter((r) => r.mode === "live" && now - r.at < 24 * HOUR).length;
  return {
    generatedAt: now,
    runs,
    logCapacity: 500,
    server: {
      uptimeMs: 6 * HOUR + 12 * 60_000,
      liveConfigured: true,
      livePaused: false,
      liveEnabled: true,
      models: { smart: "claude-sonnet-5-5", build: "claude-sonnet-5-5", fast: "claude-haiku-5-5" },
      limits: { ...SAMPLE_LIMITS, usedToday, dayResetsAt: now + 9 * HOUR, visitorsTracked: 5 },
    },
    recorded: recordedExamples(),
  };
}
