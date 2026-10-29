import type { Run, Shot } from "./run";

// What a finished real run left behind, read from the tool lines in the agents' output. Browser and server safe.

export type Evidence = {
  /** The sample app's own tests, as the sandbox reported them, for example "8 passed, 0 failed". */
  unit: string | null;
  /** The real browser test, for example "2 passed, 0 failed". */
  browser: string | null;
  /** Files the engineers wrote, in the order they first wrote them. */
  files: string[];
  /** One picture from the real browser, when there is one. */
  shot: Shot | null;
};

const RESULT = /^› (npm test|real browser): (\d+ passed, \d+ failed)\s*$/;
const WRITE = /^› write_file (.+?)\s*$/;

/**
 * Evidence for a live run or a replay of one. A simulation ran no code, so it has none, whatever its text says.
 * Returns null when the run left no test result, no file and no picture.
 */
export function runEvidence(run: Run): Evidence | null {
  if (run.mode !== "live" && run.source !== "live-run") return null;

  let unit: string | null = null;
  let browser: string | null = null;
  const files: string[] = [];
  let shot: Shot | null = null;

  for (const step of run.steps) {
    for (const line of step.text.split("\n")) {
      const result = RESULT.exec(line);
      if (result) {
        if (result[1] === "npm test") unit = result[2];
        else browser = result[2];
        continue;
      }
      const write = WRITE.exec(line);
      if (write && !files.includes(write[1])) files.push(write[1]);
    }
    // The last picture is the browser test of the new feature itself; the first is the basic add-and-delete check.
    if (step.agent === "e2e" && step.shots?.length) shot = step.shots[step.shots.length - 1];
  }

  if (!unit && !browser && files.length === 0 && !shot) return null;
  return { unit, browser, files, shot };
}
