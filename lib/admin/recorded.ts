import recordings from "../recordings.json";

// The three real recorded runs, summarised for the admin pages. Browser and server safe.

export type RecordedExample = {
  request: string;
  rounds: number;
  approved: boolean;
  totalMs: number;
  models: string[];
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
