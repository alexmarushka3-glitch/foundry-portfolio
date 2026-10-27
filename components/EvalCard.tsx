import { summarizeRuns, type EvalRun } from "@/lib/eval/summarize";

const pct = (n: number) => `${Math.round(n * 100)}%`;

/** Measured results from real live runs. Renders nothing until there are some. */
export default function EvalCard({ runs }: { runs: EvalRun[] }) {
  const s = summarizeRuns(runs);
  if (s.total === 0) return null;

  return (
    <div className="eval-card">
      <h3>Measured runs</h3>
      <p>
        {s.approved} of {s.total} live runs were approved by the pipeline&apos;s checks: the other agents, the sample app&apos;s own tests and a
        real browser test. {s.sentBack} {s.sentBack === 1 ? "was" : "were"} sent back for a second round at least once. With this few runs the true rate could be anywhere from{" "}
        {pct(s.low ?? 0)} to {pct(s.high ?? 1)}, so this is a small sample, not a success rate.
      </p>
      <p>
        Average cost ${s.avgCostUsd?.toFixed(2)} and {Math.round((s.avgMs ?? 0) / 1000)} s per run, counting runs that were not approved. The
        runs used four kinds of change on a small sample app. No human reviewed any of the pull request drafts.
      </p>
    </div>
  );
}
