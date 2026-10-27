import { liveConfigured, liveEnabled, MODELS } from "../pipeline/config";
import type { RunRecord } from "../server/runLog";
import { serverState } from "../server/state";
import { recordedExamples, type RecordedExample } from "./recorded";

// The payload behind GET /api/admin/stats: recent runs plus how the server is configured.

export type AdminOverview = {
  generatedAt: number;
  runs: RunRecord[];
  logCapacity: number;
  /** True when the run log is kept in a database and survives restarts. */
  logPersistent?: boolean;
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

export async function buildOverview(now: number = Date.now()): Promise<AdminOverview> {
  const state = serverState();
  return {
    generatedAt: now,
    runs: await state.runLog.list(),
    logCapacity: state.runLog.capacity,
    logPersistent: state.runLog.persistent,
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
