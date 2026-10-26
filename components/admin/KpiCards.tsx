import type { Kpis } from "@/lib/admin/aggregate";
import { formatDuration, formatPercent, formatTotalCost } from "@/lib/format";

type Card = { label: string; value: string; note: string; tone?: "good" | "warn" };

/** The headline numbers for the runs currently in view. */
/** `compact` keeps the four numbers a visitor cares about, for the home page. */
export default function KpiCards({ kpis, compact = false }: { kpis: Kpis; compact?: boolean }) {
  const cards: Card[] = [
    { label: "Runs", value: String(kpis.total), note: `${kpis.visitors} visitor${kpis.visitors === 1 ? "" : "s"}` },
    { label: "Live runs", value: String(kpis.live), note: "real Claude calls" },
    {
      label: "Passed both checks",
      value: kpis.approvalRate === null ? "n/a" : formatPercent(kpis.approvalRate),
      note: "of runs that finished",
      tone: kpis.approvalRate !== null && kpis.approvalRate >= 0.8 ? "good" : undefined,
    },
    { label: "Average time", value: kpis.avgMs === null ? "n/a" : formatDuration(kpis.avgMs), note: "finished runs" },
    { label: "Estimated cost", value: formatTotalCost(kpis.costUsd), note: "live runs only" },
    { label: "Errors", value: String(kpis.errors), note: "runs that stopped", tone: kpis.errors > 0 ? "warn" : undefined },
  ];
  const shown = compact ? cards.filter((c) => ["Runs", "Passed both checks", "Average time", "Estimated cost"].includes(c.label)) : cards;
  return (
    <ul className="kpis" aria-label="Key numbers">
      {shown.map((c) => (
        <li key={c.label} className={`kpi${c.tone ? ` ${c.tone}` : ""}`}>
          <p className="kpi-label">{c.label}</p>
          <p className="kpi-value">{c.value}</p>
          <p className="kpi-note">{c.note}</p>
        </li>
      ))}
    </ul>
  );
}
