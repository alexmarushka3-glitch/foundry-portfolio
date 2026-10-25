import type { Bucket } from "@/lib/admin/aggregate";
import type { Mode } from "@/lib/types";

// Small dependency-free SVG charts for the admin dashboard. Each one carries a text summary
// (aria-label) so it is useful without sight of the picture.

export const MODE_COLOR: Record<Mode, string> = {
  live: "var(--verdigris)",
  simulated: "var(--amber)",
  replay: "#6f7f8c",
};
const MODE_ORDER: Mode[] = ["live", "simulated", "replay"];

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="legend">
      {items.map((i) => (
        <li key={i.label}>
          <span className="swatch" style={{ background: i.color }} aria-hidden="true" />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

/** Runs per time bucket, stacked by mode. */
export function StackedBars({ buckets }: { buckets: Bucket[] }) {
  const W = 600;
  const H = 180;
  const pad = { l: 28, r: 4, t: 8, b: 22 };
  const totals = buckets.map((b) => MODE_ORDER.reduce((s, m) => s + b.counts[m], 0));
  const max = Math.max(1, ...totals);
  const niceMax = max <= 4 ? 4 : Math.ceil(max / 4) * 4;
  const bw = (W - pad.l - pad.r) / buckets.length;
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / niceMax);
  const sum = totals.reduce((s, v) => s + v, 0);
  const every = Math.ceil(buckets.length / 8);

  return (
    <div className="chart-scroll">
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Runs over time. ${sum} runs across ${buckets.length} periods.`}>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={pad.l} x2={W - pad.r} y1={y(niceMax * f)} y2={y(niceMax * f)} className="gridline" />
            <text x={pad.l - 6} y={y(niceMax * f) + 4} textAnchor="end" className="tick">
              {Math.round(niceMax * f)}
            </text>
          </g>
        ))}
        {buckets.map((b, i) => {
          let acc = 0;
          const x = pad.l + i * bw + bw * 0.15;
          return (
            <g key={b.start}>
              <title>{`${b.label}: ${totals[i]} run${totals[i] === 1 ? "" : "s"}`}</title>
              {MODE_ORDER.map((m) => {
                const v = b.counts[m];
                if (!v) return null;
                const top = y(acc + v);
                const h = y(acc) - top;
                acc += v;
                return <rect key={m} x={x} y={top} width={bw * 0.7} height={h} rx={2} fill={MODE_COLOR[m]} />;
              })}
              {i % every === 0 && (
                <text x={x + bw * 0.35} y={H - 6} textAnchor="middle" className="tick">
                  {b.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Share of runs by category, as a ring with the total in the middle. */
export function Donut({ slices, label }: { slices: { label: string; value: number; color: string }[]; label: string }) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const R = 52;
  const C = 2 * Math.PI * R;
  let offset = 0;
  const description = `${label}: ${slices.map((s) => `${s.label} ${s.value}`).join(", ")}.`;
  return (
    <svg className="donut" viewBox="0 0 140 140" role="img" aria-label={description}>
      <circle cx="70" cy="70" r={R} fill="none" className="donut-track" strokeWidth="16" />
      {total > 0 &&
        slices.map((s) => {
          const len = (s.value / total) * C;
          const el = (
            <circle
              key={s.label}
              cx="70"
              cy="70"
              r={R}
              fill="none"
              stroke={s.color}
              strokeWidth="16"
              strokeDasharray={`${len} ${C - len}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 70 70)"
            >
              <title>{`${s.label}: ${s.value}`}</title>
            </circle>
          );
          offset += len;
          return el;
        })}
      <text x="70" y="68" textAnchor="middle" className="donut-total">
        {total}
      </text>
      <text x="70" y="86" textAnchor="middle" className="tick">
        runs
      </text>
    </svg>
  );
}

/** Horizontal bars, one per row. */
export function HBars({ rows, format }: { rows: { label: string; value: number; note?: string }[]; format: (v: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="hbars" aria-label="Average time per agent">
      {rows.map((r) => (
        <li key={r.label}>
          <span className="hbar-label">{r.label}</span>
          <span className="hbar-track" aria-hidden="true">
            <span className="hbar-fill" style={{ width: `${(r.value / max) * 100}%` }} />
          </span>
          <span className="hbar-value">{r.value > 0 ? format(r.value) : "no data"}</span>
        </li>
      ))}
    </ul>
  );
}
