/** Four app ideas, the kind a visitor types. Batches cycle through them in order. The first three are the recorded examples. */
export const EVAL_REQUESTS: string[] = [
  "A tip calculator that splits the bill between friends",
  "A habit tracker where I check off habits each day and see my streak",
  "Flashcards for studying: add cards, flip them, and shuffle",
  "A countdown timer for workouts with rounds and rest",
];

export const MAX_EVAL_RUNS = 20;

/** A safe upper bound for one live run of the app builder, used for the spend cap. */
export const UPPER_COST_PER_RUN_USD = 0.45;

export function planBatch(runs: number): { requests: string[]; maxCostUsd: number } {
  if (!Number.isInteger(runs) || runs < 1)
    throw new Error("Runs must be a whole number of at least 1.");
  if (runs > MAX_EVAL_RUNS) throw new Error(`Run at most ${MAX_EVAL_RUNS} at a time.`);
  return {
    requests: Array.from({ length: runs }, (_, i) => EVAL_REQUESTS[i % EVAL_REQUESTS.length]),
    maxCostUsd: runs * UPPER_COST_PER_RUN_USD,
  };
}
