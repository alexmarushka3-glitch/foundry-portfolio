import type { Emit, FoundryEvent } from "../types";

export type TimedEvent = { at: number; event: FoundryEvent };

export type LiveRecording = {
  slug: string;
  request: string;
  recordedAt: string;
  events: TimedEvent[];
  approved: boolean;
  rounds: number;
  totalMs: number;
  costUsd: number;
};

export const MAX_RECORDING_CHARS = 1_500_000;

// Patterns that must never end up in a committed recording.
const SECRET_PATTERNS: RegExp[] = [
  /sk-ant-/i,
  /sk-[A-Za-z0-9]{20,}/,
  /gh[pousr]_[A-Za-z0-9]{20,}/,
  /github_pat_/i,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /ANTHROPIC_API_KEY\s*[=:]/i,
  /(?:KV_REST_API_TOKEN|ADMIN_TOKEN|CRON_SECRET|GITHUB_APP_PRIVATE_KEY)\s*[=:]/i,
  /VERCEL_(?:OIDC_)?TOKEN\s*[=:]/i,
];

/** Runs one pipeline run, timestamps every event (ms since start) and checks it is a clean, finished live run. */
export async function captureRun(
  slug: string,
  request: string,
  run: (emit: Emit) => Promise<void>,
  now: () => number = Date.now,
): Promise<LiveRecording> {
  const started = now();
  const events: TimedEvent[] = [];
  await run((event) => events.push({ at: Math.max(0, now() - started), event }));

  const firstMode = events.find((e) => e.event.type === "mode")?.event;
  if (!firstMode || firstMode.type !== "mode" || firstMode.mode !== "live") {
    throw new Error("Not a live run: the first mode event was not live.");
  }
  const finish = events.find((e) => e.event.type === "finish")?.event;
  if (!finish || finish.type !== "finish") throw new Error("The run has no finish event.");

  for (const { event } of events) {
    const text = JSON.stringify(event);
    if (SECRET_PATTERNS.some((p) => p.test(text))) {
      throw new Error("An event contains something that looks like a secret; recording refused.");
    }
  }

  let costUsd = 0;
  for (const { event } of events) if (event.type === "usage") costUsd += event.costUsd;

  return {
    slug,
    request,
    recordedAt: new Date().toISOString(),
    events,
    approved: finish.approved,
    rounds: finish.rounds,
    totalMs: finish.ms,
    costUsd,
  };
}

export function assertRecordingSize(json: string): void {
  if (json.length > MAX_RECORDING_CHARS) {
    throw new Error(`Recording is ${json.length} characters, over the ${MAX_RECORDING_CHARS} limit.`);
  }
}
