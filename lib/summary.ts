import { formatDuration, formatRunCost } from "./format";
import type { Run } from "./run";

/** The one-line result shown under a finished run. Says plainly whether a model ran. */
export function runSummary(run: Run): string {
  const verdict = run.approved
    ? `Passed both checks in ${run.rounds} round${run.rounds > 1 ? "s" : ""}.`
    : "Stopped without passing both checks.";
  switch (run.mode) {
    case "replay":
      return `${verdict} The real run took ${formatDuration(run.realMs)}.`;
    case "live": {
      const cost = run.costUsd !== undefined ? ` Estimated cost: ${formatRunCost(run.costUsd)}.` : "";
      return `${verdict} Took ${formatDuration(run.realMs)}.${cost}`;
    }
    case "simulated":
      return `${verdict} This was scripted text, so no model ran.`;
  }
}
