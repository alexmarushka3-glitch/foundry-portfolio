import { envInt } from "./env";
import { createLiveBrake, type LiveBrake } from "./liveBrake";
import { SlidingWindowLimiter } from "./rateLimit";
import { FallbackRunStore, MemoryRunStore, createRunStore, type RunStore } from "./runStore";

// Everything the server remembers between requests, in one place. It hangs off globalThis so that
// development hot reloads don't wipe it. Each serverless instance has its own copy.

type ServerState = {
  startedAt: number;
  runLog: RunStore;
  liveLimiter: LiveBrake;
  loginLimiter: SlidingWindowLimiter;
  /** Admin kill switch. `paused` turns live runs off until someone turns them back on. */
  admin: { livePaused: boolean };
};

const g = globalThis as typeof globalThis & { __foundry?: ServerState };

/** Memory alone stays as is; a database gets the memory fallback around it. */
function openRunLog(): RunStore {
  const store = createRunStore();
  return store instanceof MemoryRunStore ? store : new FallbackRunStore(store);
}

export function serverState(): ServerState {
  g.__foundry ??= {
    startedAt: Date.now(),
    runLog: openRunLog(),
    liveLimiter: createLiveBrake({
      // A live run with tools costs roughly 20 cents, so these keep a bad day to a couple of dollars.
      perHour: envInt("FOUNDRY_LIVE_PER_HOUR", 1),
      perDay: envInt("FOUNDRY_LIVE_PER_DAY", 8),
    }),
    loginLimiter: new SlidingWindowLimiter(5, 15 * 60_000),
    admin: { livePaused: false },
  };
  return g.__foundry;
}

/** Test helper: forget everything. */
export function resetServerState(): void {
  delete g.__foundry;
}
