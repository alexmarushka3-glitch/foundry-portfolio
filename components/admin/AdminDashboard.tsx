"use client";

import { useMemo, useState } from "react";
import { Donut, HBars, Legend, MODE_COLOR, StackedBars } from "./charts";
import ControlPanel from "./ControlPanel";
import FilterBar from "./FilterBar";
import KpiCards from "./KpiCards";
import RunsTable from "./RunsTable";
import { useAdminData } from "./useAdminData";
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

function downloadCsv(csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `foundry-runs-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminDashboard() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [auto, setAuto] = useState(true);
  const { data, error, loading, pending, refresh, act, signOut } = useAdminData(auto);

  const now = data?.generatedAt ?? 0;
  const shown = useMemo(() => (data ? filterRuns(data.runs, filters, now) : []), [data, filters, now]);
  const numbers = useMemo(() => kpis(shown), [shown]);
  const timings = useMemo(() => agentTimings(shown), [shown]);
  const buckets = useMemo(() => bucketRuns(shown, filters.range === "all" ? "7d" : filters.range, now), [shown, filters.range, now]);
  const byStatus = useMemo(() => countBy(shown, (r) => r.status), [shown]);
  const byMode = useMemo(() => countBy(shown, (r) => r.mode), [shown]);

  return (
    <div className="admin">
      <header className="admin-bar">
        <div>
          <h1>Foundry admin</h1>
          <p className="muted">
            {data ? `Updated ${formatAgo(data.generatedAt)}. Server up ${formatDuration(data.server.uptimeMs)}.` : "Loading…"}
          </p>
        </div>
        <div className="bar-actions">
          <label className="switch">
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
            <span>Auto-refresh</span>
          </label>
          <button type="button" onClick={() => void refresh()}>
            Refresh
          </button>
          <button type="button" onClick={() => void signOut()}>
            Sign out
          </button>
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
          <p className="notice">
            Runs are kept in this server&rsquo;s memory (the last {data.logCapacity}) and reset when the server restarts. Only runs
            that reach the API are counted. Replays of the three examples play in the visitor&rsquo;s browser.
          </p>

          <FilterBar filters={filters} onChange={setFilters} shown={shown.length} total={data.runs.length} />
          <KpiCards kpis={numbers} />

          <div className="grid">
            <section className="card wide" aria-labelledby="runs-over-time">
              <h2 id="runs-over-time">Runs over time</h2>
              <StackedBars buckets={buckets} />
              <Legend items={MODES.map((m) => ({ label: m, color: MODE_COLOR[m] }))} />
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
                <Legend items={(Object.keys(STATUS_LABEL) as RunStatus[]).map((s) => ({ label: `${STATUS_LABEL[s]} (${byStatus[s] ?? 0})`, color: STATUS_COLOR[s] }))} />
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
              onExport={() => downloadCsv(toCsv(shown))}
              exportCount={shown.length}
            />

            <section className="card" aria-labelledby="by-mode">
              <h2 id="by-mode">Modes</h2>
              <ul className="stat-list">
                {MODES.map((m) => (
                  <li key={m}>
                    <span className={`pill ${m}`}>{m}</span>
                    <strong>{byMode[m] ?? 0}</strong>
                  </li>
                ))}
              </ul>
              <p className="fine">
                Models in use: {data.server.models.fast} (fast), {data.server.models.build} (build), {data.server.models.smart} (smart).
              </p>
            </section>
          </div>

          <section className="card" aria-labelledby="runs-title">
            <h2 id="runs-title">Runs</h2>
            <RunsTable runs={shown} now={now} />
          </section>

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
                      <td className="num">{r.rounds}</td>
                      <td className="num">{formatDuration(r.totalMs)}</td>
                      <td>{r.models.join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
