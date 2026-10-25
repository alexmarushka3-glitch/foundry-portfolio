"use client";

import { Fragment, useEffect, useState } from "react";
import { AGENT_BY_ID } from "@/lib/agents";
import { paginate, sortRuns, type SortKey, type SortState } from "@/lib/admin/aggregate";
import { formatAgo, formatDuration, formatRunCost } from "@/lib/format";
import type { RunRecord, RunStatus } from "@/lib/server/runLog";
import type { AgentName } from "@/lib/types";

const PAGE_SIZE = 10;

const STATUS_LABEL: Record<RunStatus, string> = {
  approved: "Passed",
  "not-approved": "Did not pass",
  error: "Error",
  cancelled: "Visitor left",
};

const COLUMN_LABEL: Record<SortKey, string> = { at: "When", ms: "Time", costUsd: "Cost" };

type Props = { runs: RunRecord[]; now: number };

export default function RunsTable({ runs, now }: Props) {
  const [sort, setSort] = useState<SortState>({ key: "at", dir: "desc" });
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);

  // A new filter means a new list: go back to the first page.
  const signature = runs.length ? `${runs.length}:${runs[0].id}` : "empty";
  useEffect(() => setPage(1), [signature]);

  const view = paginate(sortRuns(runs, sort), page, PAGE_SIZE);

  const header = (key: SortKey) => {
    const active = sort.key === key;
    return (
      <th scope="col" aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"} className={key === "at" ? "" : "num"}>
        <button type="button" className="sort" onClick={() => setSort({ key, dir: active && sort.dir === "desc" ? "asc" : "desc" })}>
          {COLUMN_LABEL[key]}
          <span aria-hidden="true">{active ? (sort.dir === "asc" ? " ▲" : " ▼") : ""}</span>
        </button>
      </th>
    );
  };

  if (runs.length === 0) {
    return (
      <p className="empty-state">
        No runs match. Runs appear here when someone types their own idea on the site. Replays of the three examples play in the
        browser and are not counted.
      </p>
    );
  }

  return (
    <>
      <label className="mobile-sort">
        <span>Sort by</span>
        <select
          value={`${sort.key}-${sort.dir}`}
          onChange={(e) => {
            const [key, dir] = e.target.value.split("-") as [SortKey, SortState["dir"]];
            setSort({ key, dir });
          }}
        >
          <option value="at-desc">Newest first</option>
          <option value="at-asc">Oldest first</option>
          <option value="ms-desc">Slowest first</option>
          <option value="ms-asc">Fastest first</option>
          <option value="costUsd-desc">Costliest first</option>
          <option value="costUsd-asc">Cheapest first</option>
        </select>
      </label>
      <div className="table-wrap" tabIndex={0} role="region" aria-label="Runs table">
        <table className="runs">
          <thead>
            <tr>
              {header("at")}
              <th scope="col">Idea</th>
              <th scope="col">Mode</th>
              <th scope="col">Result</th>
              {header("ms")}
              {header("costUsd")}
              <th scope="col">
                <span className="sr-only">Details</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {view.items.map((r) => {
              const expanded = open === r.id;
              return (
                <Fragment key={r.id}>
                  <tr>
                    <td title={new Date(r.at).toLocaleString()}>{formatAgo(r.at, now)}</td>
                    <td className="idea-cell">{r.request}</td>
                    <td>
                      <span className={`pill ${r.mode}`}>{r.mode}</span>
                    </td>
                    <td>
                      <span className={`pill status-${r.status}`}>{STATUS_LABEL[r.status]}</span>
                    </td>
                    <td className="num" data-label="Time">{formatDuration(r.ms)}</td>
                    <td className="num" data-label="Cost">{r.mode === "live" ? formatRunCost(r.costUsd) : "–"}</td>
                    <td className="num">
                      <button
                        type="button"
                        className="link"
                        aria-expanded={expanded}
                        aria-controls={`detail-${r.id}`}
                        onClick={() => setOpen(expanded ? null : r.id)}
                      >
                        {expanded ? "Hide" : "Details"}
                      </button>
                    </td>
                  </tr>
                  {expanded && (
                    <tr className="detail" id={`detail-${r.id}`}>
                      <td colSpan={7}>
                        <dl>
                          <div>
                            <dt>Visitor</dt>
                            <dd>{r.visitor}</dd>
                          </div>
                          <div>
                            <dt>Rounds</dt>
                            <dd>{r.rounds || "–"}</dd>
                          </div>
                          <div>
                            <dt>Tokens in / out</dt>
                            <dd>{r.mode === "live" ? `${r.inputTokens} / ${r.outputTokens}` : "–"}</dd>
                          </div>
                          {r.error && (
                            <div>
                              <dt>Error</dt>
                              <dd>{r.error}</dd>
                            </div>
                          )}
                          {(Object.entries(r.agentMs) as [AgentName, number][]).map(([agent, ms]) => (
                            <div key={agent}>
                              <dt>{AGENT_BY_ID[agent].label}</dt>
                              <dd>{formatDuration(ms)}</dd>
                            </div>
                          ))}
                        </dl>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <nav className="pager" aria-label="Table pages">
        <button type="button" onClick={() => setPage(view.page - 1)} disabled={view.page <= 1}>
          Previous
        </button>
        <span>
          Page {view.page} of {view.pages}
        </span>
        <button type="button" onClick={() => setPage(view.page + 1)} disabled={view.page >= view.pages}>
          Next
        </button>
      </nav>
    </>
  );
}
