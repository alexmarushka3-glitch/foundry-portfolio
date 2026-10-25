import { DEFAULT_FILTERS, filtersActive, type Filters, type RangeKey } from "@/lib/admin/aggregate";
import type { RunStatus } from "@/lib/server/runLog";
import type { Mode } from "@/lib/types";

const RANGES: { value: RangeKey; label: string }[] = [
  { value: "1h", label: "Last hour" },
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "all", label: "Everything kept" },
];
const MODES: { value: Mode | "all"; label: string }[] = [
  { value: "all", label: "All modes" },
  { value: "live", label: "Live" },
  { value: "simulated", label: "Simulated" },
  { value: "replay", label: "Replay (API)" },
];
const STATUSES: { value: RunStatus | "all"; label: string }[] = [
  { value: "all", label: "Any result" },
  { value: "approved", label: "Passed both checks" },
  { value: "not-approved", label: "Did not pass" },
  { value: "error", label: "Error" },
  { value: "cancelled", label: "Visitor left" },
];

type Props = { filters: Filters; onChange: (f: Filters) => void; shown: number; total: number };

export default function FilterBar({ filters, onChange, shown, total }: Props) {
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => onChange({ ...filters, [key]: value });
  return (
    <form className="filters" role="search" aria-label="Filter runs" onSubmit={(e) => e.preventDefault()}>
      <label>
        <span>Time</span>
        <select value={filters.range} onChange={(e) => set("range", e.target.value as RangeKey)}>
          {RANGES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Mode</span>
        <select value={filters.mode} onChange={(e) => set("mode", e.target.value as Filters["mode"])}>
          {MODES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Result</span>
        <select value={filters.status} onChange={(e) => set("status", e.target.value as Filters["status"])}>
          {STATUSES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </label>
      <label className="grow">
        <span>Search</span>
        <input type="search" value={filters.query} placeholder="Search ideas" onChange={(e) => set("query", e.target.value)} />
      </label>
      <div className="filters-end">
        <p className="count" aria-live="polite">
          {shown} of {total} runs
        </p>
        {filtersActive(filters) && (
          <button type="button" className="link" onClick={() => onChange(DEFAULT_FILTERS)}>
            Reset filters
          </button>
        )}
      </div>
    </form>
  );
}
