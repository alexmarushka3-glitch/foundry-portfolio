"use client";

import { useMemo, useState } from "react";
import "./admin.css";
import { Donut, HBars, Legend, MODE_COLOR, StackedBars } from "./charts";
import ControlPanel from "./ControlPanel";
import SandboxPanel from "./SandboxPanel";
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
  // On the home page the dashboard starts as just the key numbers; the filters, charts, controls and runs table open on request.
  const [open, setOpen] = useState(!embedded);
  const Title = embedded ? "h3" : "h1";
  const Card = embedded ? "h4" : "h2";
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
          runs or costs, and the buttons only change what you see here. The three recorded examples at the bottom are the real live-run recordings.{" "}
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
                ? "On the real dashboard, the last 500 runs are kept in the server's memory and reset when the server restarts, unless a database is connected. Only runs that reach the API are counted."
                : `${
                    data.logPersistent
                      ? `The last ${data.logCapacity} runs are kept in a database and survive restarts.`
                      : `Runs are kept in this server's memory (the last ${data.logCapacity}) and reset when the server restarts.`
                  } Only runs that reach the API are counted. Replays of the three examples play in the visitor's browser.`}
            </p>
          )}

          {open && <FilterBar filters={filters} onChange={setFilters} shown={shown.length} total={data.runs.length} />}
          <KpiCards kpis={numbers} compact={embedded} />

          {embedded && (
            <p className="dash-toggle">
              <button type="button" aria-expanded={open} aria-controls="dash-more" onClick={() => setOpen((v) => !v)}>
                {open ? "Hide the full sample dashboard" : "Show the full sample dashboard"}
              </button>
            </p>
          )}

          <div id="dash-more" hidden={!open}>
          <div className="grid">
            <section className="card wide" aria-labelledby="runs-over-time">
              <Card id="runs-over-time">Runs over time</Card>
              <StackedBars buckets={buckets} />
              <Legend items={MODES.map((m) => ({ label: `${m} (${byMode[m] ?? 0})`, color: MODE_COLOR[m] }))} />
            </section>

            <section className="card" aria-labelledby="by-result">
              <Card id="by-result">Results</Card>
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
              <Card id="by-agent">Average time per agent</Card>
              <HBars rows={timings.map((t) => ({ label: t.label, value: t.avgMs }))} format={formatDuration} />
            </section>

            <ControlPanel
              server={data.server}
              pending={pending}
              onAct={(a) => void act(a)}
              sample={sample}
              heading={embedded ? "h4" : "h2"}
              onExport={() => downloadCsv(toCsv(shown), sample ? "sample-foundry-runs" : "foundry-runs")}
              exportCount={shown.length}
            />

            {!sample && <SandboxPanel />}
          </div>

          <section className="card" aria-labelledby="runs-title">
            <div className="card-head">
              <Card id="runs-title">Runs</Card>
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
          </div>

          {!embedded && (
            <section className="card" aria-labelledby="recorded-title">
              <h2 id="recorded-title">Recorded examples</h2>
              <p className="muted">The three real live runs the site replays, each kept as it came out. They are fixed, so replaying them costs nothing.</p>
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
