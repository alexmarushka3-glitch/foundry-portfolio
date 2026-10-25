// Small display helpers shared by the stage and the admin dashboard. Safe in the browser and on the server.

/** "7.4s" under a minute, "1m 22s" above. */
export function formatDuration(ms: number): string {
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${Math.round(s - m * 60)}s`;
}

/** Playback clock, "1:05". */
export function formatClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const usd = (digits: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits });
const usd3 = usd(3);
const usd2 = usd(2);

/** Run costs are cents, so show three decimals: "$0.093". */
export const formatRunCost = (amount: number): string => usd3.format(amount);

/** Totals read better with two decimals: "$1.24". */
export const formatTotalCost = (amount: number): string => usd2.format(amount);

export const formatPercent = (ratio: number): string => `${Math.round(ratio * 100)}%`;

/** "just now", "5m ago", "3h ago", "2d ago". */
export function formatAgo(at: number, now: number = Date.now()): string {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
