import { describe, expect, it } from "vitest";
import { runEvidence } from "../lib/evidence";
import { buildLiveReplayRun } from "../lib/liveReplay";
import type { LiveRecording } from "../lib/recorder/capture";
import recordings from "../lib/liveRecordings.json";
import type { Run, Step } from "../lib/run";

const step = (agent: Step["agent"], text: string, shots?: Step["shots"]): Step => ({ agent, round: 1, model: "m", text, start: 0, end: 1, ms: 1, shots });
const run = (over: Partial<Run>, steps: Step[]): Run => ({ request: "r", mode: "live", steps, total: 1, approved: true, rounds: 1, realMs: 1, ...over });

describe("runEvidence", () => {
  it("reads the test results, the written files and a browser picture from a live run", () => {
    const shot = { label: "after adding a task", png: "AAAA" };
    const ev = runEvidence(
      run({}, [
        step("backend", "› read_file src/db.js\n› write_file src/db.js\n› write_file tests/api.test.js\n› npm test: 8 passed, 0 failed\n"),
        step("frontend", "› write_file src/db.js\n› write_file public/app.js\n"),
        step("e2e", "› npm test: 9 passed, 0 failed\n› real browser: 2 passed, 0 failed\n", [shot]),
      ]),
    );
    expect(ev).toEqual({
      unit: "9 passed, 0 failed",
      browser: "2 passed, 0 failed",
      files: ["src/db.js", "tests/api.test.js", "public/app.js"],
      shot,
    });
  });

  it("gives a replay of a real live run the same evidence", () => {
    const ev = runEvidence(run({ mode: "replay", source: "live-run" }, [step("e2e", "› real browser: 2 passed, 0 failed\n")]));
    expect(ev?.browser).toBe("2 passed, 0 failed");
  });

  it("gives a simulation none, even if its text looks like test output", () => {
    expect(runEvidence(run({ mode: "simulated" }, [step("e2e", "› npm test: 8 passed, 0 failed\n› write_file src/db.js\n")]))).toBeNull();
  });

  it("returns nothing when the run left no result, file or picture", () => {
    expect(runEvidence(run({}, [step("backend", "› read_file src/db.js\n")]))).toBeNull();
  });

  it("finds real results in every shipped recording", () => {
    const recs = recordings.recordings as unknown as LiveRecording[];
    expect(recs.length).toBe(3);
    for (const rec of recs) {
      const ev = runEvidence(buildLiveReplayRun(rec));
      expect(ev?.unit).toMatch(/^\d+ passed, 0 failed$/);
      expect(ev?.browser).toMatch(/^\d+ passed, 0 failed$/);
      expect(ev?.files.length).toBeGreaterThan(0);
      expect(ev?.shot?.png.length).toBeGreaterThan(100);
    }
  });
});
