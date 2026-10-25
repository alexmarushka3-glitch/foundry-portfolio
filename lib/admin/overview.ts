import recordings from "../recordings.json";
import { liveConfigured, liveEnabled, MODELS } from "../pipeline/config";
import type { RunRecord } from "../server/runLog";
import { serverState } from "../server/state";

// The payload behind GET /api/admin/stats: recent runs plus how the server is configured.

export type RecordedExample = {
  request: string;
  rounds: number;
  approved: boolean;
  totalMs: number;
  models: string[];
};

export type AdminOverview = {
  generatedAt: number;
  runs: RunRecord[];
  logCapacity: number;
  server: {
    uptimeMs: number;
    liveConfigured: boolean;
    livePaused: boolean;
    liveEnabled: boolean;
    models: typeof MODELS;
    limits: ReturnType<ReturnType<typeof serverState>["liveLimiter"]["snapshot"]>;
  };
  recorded: RecordedExample[];
};

export function recordedExamples(): RecordedExample[] {
  return recordings.examples.map((e) => ({
    request: e.request,
    rounds: e.rounds,
    approved: e.approved,
    totalMs: e.totalMs,
    models: [...new Set(e.steps.map((s) => s.model))],
  }));
}

export function buildOverview(now: number = Date.now()): AdminOverview {
  const state = serverState();
  return {
    generatedAt: now,
    runs: state.runLog.list(),
    logCapacity: state.runLog.capacity,
    server: {
      uptimeMs: now - state.startedAt,
      liveConfigured: liveConfigured(),
      livePaused: state.admin.livePaused,
      liveEnabled: liveEnabled(),
      models: MODELS,
      limits: state.liveLimiter.snapshot(),
    },
    recorded: recordedExamples(),
  };
}
