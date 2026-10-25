/**
 * Read a non-negative whole number from the environment.
 * An unset, empty or unparsable value falls back, so `FOUNDRY_LIVE_PER_HOUR=` can't silently mean "0 runs".
 */
export function envInt(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}
