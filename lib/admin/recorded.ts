import data from "../liveRecordings.json";
import type { LiveRecording } from "../recorder/capture";

// The three real recorded live runs, summarised for the admin pages. Browser and server safe.

export type RecordedExample = {
  request: string;
  rounds: number;
  approved: boolean;
  totalMs: number;
  models: string[];
  costUsd: number;
};

export function recordedExamples(): RecordedExample[] {
  return (data.recordings as unknown as LiveRecording[]).map((r) => ({
    request: r.request,
    rounds: r.rounds,
    approved: r.approved,
    totalMs: r.totalMs,
    models: [...new Set(r.events.flatMap((e) => (e.event.type === "start" ? [e.event.model] : [])))],
    costUsd: r.costUsd,
  }));
}
