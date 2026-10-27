import { buildRequest, type FeatureSpec } from "../spec";

/** Four requests the form can build, one per kind of change. Batches cycle through them in order. */
const SPECS: FeatureSpec[] = [
  { kind: "field", name: "estimate", valueType: "number", required: false },
  { kind: "filter", name: "completed" },
  { kind: "sort", name: "created date" },
  { kind: "bulk", name: "mark all done" },
];

export const EVAL_REQUESTS: string[] = SPECS.map(buildRequest);

export const MAX_EVAL_RUNS = 20;

/** The top of the observed range for one live run ($0.18 to $0.31), rounded up. */
export const UPPER_COST_PER_RUN_USD = 0.35;

export function planBatch(runs: number): { requests: string[]; maxCostUsd: number } {
  if (!Number.isInteger(runs) || runs < 1) throw new Error("Runs must be a whole number of at least 1.");
  if (runs > MAX_EVAL_RUNS) throw new Error(`Run at most ${MAX_EVAL_RUNS} at a time.`);
  return {
    requests: Array.from({ length: runs }, (_, i) => EVAL_REQUESTS[i % EVAL_REQUESTS.length]),
    maxCostUsd: runs * UPPER_COST_PER_RUN_USD,
  };
}
