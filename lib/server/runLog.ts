import { createHash, randomUUID } from "node:crypto";
import type { AgentName, FoundryEvent, Mode } from "../types";

// A short history of API runs, for the admin dashboard. `RunLog` is the in-memory list; `runStore.ts` decides
// whether it is used alone (resets on a cold start) or backed by a database.
// Replays that play in the browser never reach the server, so they are not logged.

export type RunStatus = "approved" | "not-approved" | "error" | "cancelled";

export type RunRecord = {
  id: string;
  /** When the run started, ms since epoch. */
  at: number;
  request: string;
  mode: Mode;
  status: RunStatus;
  /** Wall-clock time of the whole run. */
  ms: number;
  rounds: number;
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
  /** Time each agent took, summed over rounds. */
  agentMs: Partial<Record<AgentName, number>>;
  error?: string;
  /** Short hash of the visitor's address. The address itself is never stored. */
  visitor: string;
};

export class RunLog {
  private records: RunRecord[] = [];

  constructor(public readonly capacity = 500) {}

  add(record: RunRecord): void {
    this.records.push(record);
    if (this.records.length > this.capacity) this.records.splice(0, this.records.length - this.capacity);
  }

  /** Newest first. */
  list(): RunRecord[] {
    return [...this.records].reverse();
  }

  clear(): number {
    const n = this.records.length;
    this.records = [];
    return n;
  }
}

export const hashVisitor = (address: string): string => createHash("sha256").update(address).digest("hex").slice(0, 8);

/** Watches the events of one run and turns them into a RunRecord. */
export function createRecorder(meta: { request: string; visitor: string; now?: () => number }) {
  const now = meta.now ?? Date.now;
  const started = now();
  const record: RunRecord = {
    id: randomUUID(),
    at: started,
    request: meta.request,
    mode: "simulated",
    status: "error",
    ms: 0,
    rounds: 0,
    costUsd: 0,
    inputTokens: 0,
    outputTokens: 0,
    agentMs: {},
    visitor: meta.visitor,
  };
  let finished = false;

  return {
    observe(e: FoundryEvent): void {
      switch (e.type) {
        case "mode":
          record.mode = e.mode;
          break;
        case "done":
          record.agentMs[e.agent] = (record.agentMs[e.agent] ?? 0) + e.ms;
          break;
        case "usage":
          record.costUsd += e.costUsd;
          record.inputTokens += e.inputTokens;
          record.outputTokens += e.outputTokens;
          break;
        case "finish":
          finished = true;
          record.rounds = e.rounds;
          record.status = e.approved ? "approved" : "not-approved";
          break;
        case "error":
          record.status = "error";
          record.error = e.message;
          break;
      }
    },
    /** Call once, after the run ends or the visitor leaves. */
    close(cancelled = false): RunRecord {
      record.ms = now() - started;
      if (cancelled && !finished) record.status = "cancelled";
      return record;
    },
  };
}
