// Scores a batch of real runs. Pure, browser and server safe.

export type EvalRun = { approved: boolean; rounds: number; costUsd: number; ms: number; request?: string };

export type EvalSummary = {
  total: number;
  approved: number;
  /** Approved on the first round. */
  firstRound: number;
  /** Approved, but only after the Validator sent it back at least once. */
  afterSendBack: number;
  notApproved: number;
  /** Runs the Validator sent back at least once. */
  sentBack: number;
  rate: number | null;
  /** 95% Wilson interval around `rate`. Wide on purpose when there are few runs. */
  low: number | null;
  high: number | null;
  avgCostUsd: number | null;
  avgMs: number | null;
};

const Z = 1.96;

export function summarizeRuns(runs: EvalRun[]): EvalSummary {
  const total = runs.length;
  if (total === 0) return { total: 0, approved: 0, firstRound: 0, afterSendBack: 0, notApproved: 0, sentBack: 0, rate: null, low: null, high: null, avgCostUsd: null, avgMs: null };

  const approved = runs.filter((r) => r.approved).length;
  const firstRound = runs.filter((r) => r.approved && r.rounds <= 1).length;
  const p = approved / total;
  const denom = 1 + (Z * Z) / total;
  const centre = (p + (Z * Z) / (2 * total)) / denom;
  const margin = (Z * Math.sqrt((p * (1 - p)) / total + (Z * Z) / (4 * total * total))) / denom;

  return {
    total,
    approved,
    firstRound,
    afterSendBack: approved - firstRound,
    notApproved: total - approved,
    sentBack: runs.filter((r) => r.rounds > 1).length,
    rate: p,
    low: Math.max(0, centre - margin),
    high: Math.min(1, centre + margin),
    avgCostUsd: runs.reduce((a, r) => a + r.costUsd, 0) / total,
    avgMs: runs.reduce((a, r) => a + r.ms, 0) / total,
  };
}
