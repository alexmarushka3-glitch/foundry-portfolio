import { AGENT_LIST } from "../agents";
import type { RunRecord, RunStatus } from "../server/runLog";
import type { AgentName, Mode } from "../types";

// Pure helpers behind the admin dashboard's cards, charts and table. No server or browser APIs,
// so the numbers can be tested directly.

export type RangeKey = "1h" | "24h" | "7d" | "all";

export const RANGE_MS: Record<RangeKey, number> = {
  "1h": 3_600_000,
  "24h": 86_400_000,
  "7d": 7 * 86_400_000,
  all: Infinity,
};

export type Filters = {
  range: RangeKey;
  mode: Mode | "all";
  status: RunStatus | "all";
  query: string;
};

export const DEFAULT_FILTERS: Filters = { range: "24h", mode: "all", status: "all", query: "" };

export const filtersActive = (f: Filters): boolean =>
  f.range !== DEFAULT_FILTERS.range || f.mode !== "all" || f.status !== "all" || f.query.trim() !== "";

export function filterRuns(runs: RunRecord[], f: Filters, now: number): RunRecord[] {
  const q = f.query.trim().toLowerCase();
  return runs.filter(
    (r) =>
      now - r.at <= RANGE_MS[f.range] &&
      (f.mode === "all" || r.mode === f.mode) &&
      (f.status === "all" || r.status === f.status) &&
      (!q || r.request.toLowerCase().includes(q) || r.visitor.includes(q)),
  );
}

export type Kpis = {
  total: number;
  live: number;
  /** Approved runs as a share of runs that finished (not errors or cancellations). Null when none finished. */
  approvalRate: number | null;
  avgMs: number | null;
  costUsd: number;
  errors: number;
  visitors: number;
};

export function kpis(runs: RunRecord[]): Kpis {
  const finished = runs.filter((r) => r.status === "approved" || r.status === "not-approved");
  const approved = finished.filter((r) => r.status === "approved").length;
  return {
    total: runs.length,
    live: runs.filter((r) => r.mode === "live").length,
    approvalRate: finished.length ? approved / finished.length : null,
    avgMs: finished.length ? finished.reduce((s, r) => s + r.ms, 0) / finished.length : null,
    costUsd: runs.reduce((s, r) => s + r.costUsd, 0),
    errors: runs.filter((r) => r.status === "error").length,
    visitors: new Set(runs.map((r) => r.visitor)).size,
  };
}

export type Bucket = { start: number; label: string; counts: Record<Mode, number>; costUsd: number };

/** Runs per time bucket over the range, oldest first. Empty buckets are kept so the chart shows gaps honestly. */
export function bucketRuns(runs: RunRecord[], range: Exclude<RangeKey, "all">, now: number): Bucket[] {
  const hourly = range === "1h" || range === "24h";
  const size = range === "1h" ? 5 * 60_000 : hourly ? 3_600_000 : 86_400_000;
  const count = range === "1h" ? 12 : range === "24h" ? 24 : 7;
  const lastStart = Math.floor(now / size) * size;
  const buckets: Bucket[] = Array.from({ length: count }, (_, i) => {
    const start = lastStart - (count - 1 - i) * size;
    const d = new Date(start);
    const label = hourly
      ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: range === "1h" ? "2-digit" : undefined })
      : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return { start, label, counts: { live: 0, simulated: 0, replay: 0 }, costUsd: 0 };
  });
  for (const r of runs) {
    const idx = Math.floor((r.at - buckets[0].start) / size);
    if (idx < 0 || idx >= count) continue;
    buckets[idx].counts[r.mode] += 1;
    buckets[idx].costUsd += r.costUsd;
  }
  return buckets;
}

export const countBy = <K extends string>(runs: RunRecord[], key: (r: RunRecord) => K): Partial<Record<K, number>> => {
  const out: Partial<Record<K, number>> = {};
  for (const r of runs) out[key(r)] = (out[key(r)] ?? 0) + 1;
  return out;
};

export type AgentTiming = { agent: AgentName; label: string; avgMs: number; samples: number };

/** Average time per agent across the runs that include it. */
export function agentTimings(runs: RunRecord[]): AgentTiming[] {
  return AGENT_LIST.map((a) => {
    const times = runs.map((r) => r.agentMs[a.id]).filter((v): v is number => typeof v === "number");
    return {
      agent: a.id,
      label: a.label,
      avgMs: times.length ? times.reduce((s, v) => s + v, 0) / times.length : 0,
      samples: times.length,
    };
  });
}

export type SortKey = "at" | "ms" | "costUsd";
export type SortState = { key: SortKey; dir: "asc" | "desc" };

export function sortRuns(runs: RunRecord[], sort: SortState): RunRecord[] {
  const sign = sort.dir === "asc" ? 1 : -1;
  return [...runs].sort((a, b) => (a[sort.key] - b[sort.key]) * sign);
}

export const paginate = <T,>(items: T[], page: number, pageSize: number) => {
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(Math.max(1, page), pages);
  return { items: items.slice((current - 1) * pageSize, current * pageSize), page: current, pages };
};

/** CSV with a header row. Cells that start with = + - @ are prefixed so spreadsheets don't run them as formulas. */
export function toCsv(runs: RunRecord[]): string {
  const cell = (v: string | number | undefined): string => {
    let s = String(v ?? "");
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = ["time", "request", "mode", "status", "seconds", "rounds", "cost_usd", "input_tokens", "output_tokens", "visitor", "error"];
  const rows = runs.map((r) =>
    [
      new Date(r.at).toISOString(),
      r.request,
      r.mode,
      r.status,
      (r.ms / 1000).toFixed(1),
      r.rounds,
      r.costUsd.toFixed(4),
      r.inputTokens,
      r.outputTokens,
      r.visitor,
      r.error,
    ]
      .map(cell)
      .join(","),
  );
  return [head.join(","), ...rows].join("\n");
}
