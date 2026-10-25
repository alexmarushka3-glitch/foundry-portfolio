"use client";

import { useMemo, useState } from "react";
import "./admin.css";
import { Donut, HBars, Legend, MODE_COLOR, StackedBars } from "./charts";
import ControlPanel from "./ControlPanel";
import FilterBar from "./FilterBar";
import KpiCards from "./KpiCards";
import RunsTable from "./RunsTable";
import type { AdminData } from "./useAdminData";
import { agentTimings, bucketRuns, countBy, DEFAULT_FILTERS, filterRuns, kpis, toCsv, type Filters } from "@/lib/admin/aggregate";
import { formatAgo, formatDuration } from "@/lib/format";
import type { RunStatus } from "@/lib/server/runLog";
import type { Mode } from "@/lib/types";

const STATUS_COLOR: Record<RunStatus, string> = {
  approved: "var(--verdigris)",
  "not-approved": "var(--amber)",
  error: "var(--brick)",
  cancelled: "#8a96a0",
};
const STATUS_LABEL: Record<RunStatus, string> = {
  approved: "Passed",
  "not-approved": "Did not pass",
  error: "Error",
  cancelled: "Visitor left",
};
const MODES: Mode[] = ["live", "simulated", "replay"];

function downloadCsv(csv: string, prefix: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${prefix}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

type Props = {
  admin: AdminData;
  /** True on the public page, where every number is made up. */
  sample?: boolean;
  /** A compact version for the public page: shorter banner, no recorded-examples table, runs table behind a button. */
  embedded?: boolean;
  /** Auto-refresh switch, for the real dashboard only. */
  auto?: boolean;
  onAuto?: (on: boolean) => void;
};

/** The dashboard itself. It doesn't know where its data comes from: the real server, or the sample generator. */
export default function AdminView({ admin, sample = false, embedded = false, auto = false, onAuto }: Props) {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [showRuns, setShowRuns] = useState(!embedded);
  const Title = embedded ? "h3" : "h1";
  const { data, error, loading, pending, refresh, act, signOut } = admin;

  const now = data?.generatedAt ?? 0;
  const shown = useMemo(() => (data ? filterRuns(data.runs, filters, now) : []), [data, filters, now]);
  const numbers = useMemo(() => kpis(shown), [shown]);
  const timings = useMemo(() => agentTimings(shown), [shown]);
  const buckets = useMemo(() => bucketRuns(shown, filters.range === "all" ? "7d" : filters.range, now), [shown, filters.range, now]);
  const byStatus = useMemo(() => countBy(shown, (r) => r.status), [shown]);
  const byMode = useMemo(() => countBy(shown, (r) => r.mode), [shown]);

  return (
    <div className={`admin${embedded ? " embedded" : ""}`}>
      {sample && embedded && (
        <aside className="sample-banner" role="note">
          <strong>Sample data.</strong> Made up to show the layout. The buttons only change this page.
        </aside>
      )}
      {sample && !embedded && (
        <aside className="sample-banner" role="note">
          <strong>Sample data.</strong> Everything on this page is made up to show how the dashboard works. These are not real visitors,
          runs or costs, and the buttons only change what you see here. The three recorded examples at the bottom are the real ones.{" "}
          <a href="/">Back to the site</a>
        </aside>
      )}
      <header className="admin-bar">
        <div>
          <Title>{sample && !embedded ? "Foundry admin (sample data)" : "Foundry admin"}</Title>
          <p className="muted">
            {data
              ? sample
                ? `Sample generated ${formatAgo(data.generatedAt)}.`
                : `Updated ${formatAgo(data.generatedAt)}. Server up ${formatDuration(data.server.uptimeMs)}.`
              : "Loading…"}
          </p>
        </div>
        <div className="bar-actions">
          {onAuto && (
            <label className="switch">
              <input type="checkbox" checked={auto} onChange={(e) => onAuto(e.target.checked)} />
              <span>Auto-refresh</span>
            </label>
          )}
          <button type="button" onClick={() => void refresh()}>
            {sample ? "New sample" : "Refresh"}
          </button>
          {signOut && (
            <button type="button" onClick={() => void signOut()}>
              Sign out
            </button>
          )}
        </div>
      </header>

      {error && (
        <p className="banner error" role="alert">
          {error}
        </p>
      )}

      {loading && !data ? (
        <p className="empty-state">Loading…</p>
      ) : data ? (
        <>
          {!embedded && (
            <p className="notice">
              {sample
                ? "On the real dashboard, runs are kept in the server's memory (the last 500) and reset when the server restarts. Only runs that reach the API are counted."
                : `Runs are kept in this server's memory (the last ${data.logCapacity}) and reset when the server restarts. Only runs that reach the API are counted. Replays of the three examples play in the visitor's browser.`}
            </p>
          )}

          <FilterBar filters={filters} onChange={setFilters} shown={shown.length} total={data.runs.length} />
          <KpiCards kpis={numbers} />

          <div className="grid">
            <section className="card wide" aria-labelledby="runs-over-time">
              <h2 id="runs-over-time">Runs over time</h2>
              <StackedBars buckets={buckets} />
              <Legend items={MODES.map((m) => ({ label: `${m} (${byMode[m] ?? 0})`, color: MODE_COLOR[m] }))} />
            </section>

            <section className="card" aria-labelledby="by-result">
              <h2 id="by-result">Results</h2>
              <div className="donut-row">
                <Donut
                  label="Runs by result"
                  slices={(Object.keys(STATUS_LABEL) as RunStatus[]).map((s) => ({
                    label: STATUS_LABEL[s],
                    value: byStatus[s] ?? 0,
                    color: STATUS_COLOR[s],
                  }))}
                />
                <Legend
                  items={(Object.keys(STATUS_LABEL) as RunStatus[]).map((s) => ({
                    label: `${STATUS_LABEL[s]} (${byStatus[s] ?? 0})`,
                    color: STATUS_COLOR[s],
                  }))}
                />
              </div>
            </section>

            <section className="card" aria-labelledby="by-agent">
              <h2 id="by-agent">Average time per agent</h2>
              <HBars rows={timings.map((t) => ({ label: t.label, value: t.avgMs }))} format={formatDuration} />
            </section>

            <ControlPanel
              server={data.server}
              pending={pending}
              onAct={(a) => void act(a)}
              sample={sample}
              onExport={() => downloadCsv(toCsv(shown), sample ? "sample-foundry-runs" : "foundry-runs")}
              exportCount={shown.length}
            />
          </div>

          <section className="card" aria-labelledby="runs-title">
            <div className="card-head">
              <h2 id="runs-title">Runs</h2>
              {embedded && (
                <button type="button" aria-expanded={showRuns} aria-controls="runs-panel" onClick={() => setShowRuns((v) => !v)}>
                  {showRuns ? "Hide the runs table" : `Show the runs table (${shown.length})`}
                </button>
              )}
            </div>
            {showRuns && (
              <div id="runs-panel">
                <RunsTable runs={shown} now={now} />
              </div>
            )}
          </section>

          {!embedded && (
            <section className="card" aria-labelledby="recorded-title">
              <h2 id="recorded-title">Recorded examples</h2>
              <p className="muted">The three runs the site replays. They are fixed, so they cost nothing to show.</p>
              <div className="table-wrap" tabIndex={0} role="region" aria-label="Recorded examples">
                <table className="runs">
                  <thead>
                    <tr>
                      <th scope="col">Idea</th>
                      <th scope="col">Result</th>
                      <th scope="col" className="num">
                        Rounds
                      </th>
                      <th scope="col" className="num">
                        Real time
                      </th>
                      <th scope="col">Models</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recorded.map((r) => (
                      <tr key={r.request}>
                        <td className="idea-cell">{r.request}</td>
                        <td>
                          <span className={`pill ${r.approved ? "status-approved" : "status-not-approved"}`}>
                            {r.approved ? "Passed" : "Did not pass"}
                          </span>
                        </td>
                        <td className="num" data-label="Rounds">
                          {r.rounds}
                        </td>
                        <td className="num" data-label="Real time">
                          {formatDuration(r.totalMs)}
                        </td>
                        <td data-label="Models">{r.models.join(", ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      ) : null}
    </div>
  );
}
