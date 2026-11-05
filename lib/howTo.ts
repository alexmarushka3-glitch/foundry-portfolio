import type { Run } from "./run";

// The "how to use it" bullets the Release agent wrote for this app, shown between the agents and the finished app
// so visitors know what to do next. Taken as written (only list markers and markdown emphasis are removed).

const BULLET = /^\s*(?:[-*•]|\d+[.)])\s+(.*\S)\s*$/;

export function howToUse(run: Pick<Run, "steps">): string[] {
  const release = [...run.steps].reverse().find((s) => s.agent === "release");
  if (!release) return [];
  return release.text
    .split("\n")
    .map((line) => BULLET.exec(line)?.[1])
    .filter((b): b is string => !!b)
    .map((b) => b.replace(/\*\*|__|`/g, "").trim())
    .filter(Boolean)
    .slice(0, 4);
}
