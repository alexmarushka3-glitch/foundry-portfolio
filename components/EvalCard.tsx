import { summarizeRuns, type EvalRun } from "@/lib/eval/summarize";

const pct = (n: number) => `${Math.round(n * 100)}%`;

/** Measured results from real live runs. Renders nothing until there are some. */
export default function EvalCard({ runs }: { runs: EvalRun[] }) {
  const s = summarizeRuns(runs);
  if (s.total === 0) return null;

  const notClean = runs.filter((r) => !r.approved || r.rounds > 1);

  return (
    <div className="eval-card">
      <h3>Measured runs</h3>
      <p>
        {s.approved} of {s.total} live runs were approved by the pipeline&apos;s checks: the other agents, the sample app&apos;s own tests and a
        real browser test. {s.sentBack} {s.sentBack === 1 ? "was" : "were"} sent back for a second round at least once. With this few runs, the true rate could be anywhere from{" "}
        {pct(s.low ?? 0)} to {pct(s.high ?? 1)}, so this is a small sample, not a success rate.
      </p>
      <p>
        {s.firstRound} approved on the first round, {s.afterSendBack} approved after a second round, {s.notApproved} not approved. Runs that did
        not finish, for example because of an API error, are not counted.
      </p>
      {notClean.length > 0 && (
        <details className="eval-more">
          <summary>
            Which {notClean.length === 1 ? "run was" : `${notClean.length} runs were`} sent back or not approved
          </summary>
          <ul>
            {notClean.map((r, i) => (
              <li key={`${r.request ?? "run"}-${i}`}>
                {r.request ?? "A request"} (
                {r.approved
                  ? "approved after a second round"
                  : r.rounds > 1
                    ? "not approved after a second round"
                    : "not approved: the first round failed and the run hit its time limit before a second round"}
                )
              </li>
            ))}
          </ul>
        </details>
      )}
      <p>
        On average a run cost ${s.avgCostUsd?.toFixed(2)} and took {Math.round((s.avgMs ?? 0) / 1000)} s, counting runs that were not approved. The
        runs covered four kinds of change on a small sample app. No human reviewed any of the pull request drafts.
      </p>
    </div>
  );
}
