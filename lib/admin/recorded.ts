import summary from "../liveRecordingsSummary.json";

// The three real recorded live runs, summarised for the admin pages. Browser and server safe.
// Reads the small generated summary, never the big recordings file (it holds screenshots).

export type RecordedExample = {
  request: string;
  rounds: number;
  approved: boolean;
  totalMs: number;
  models: string[];
  costUsd: number;
};

export function recordedExamples(): RecordedExample[] {
  return summary as RecordedExample[];
}
