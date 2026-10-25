import { describe, expect, it } from "vitest";
import recordings from "@/lib/recordings.json";
import { AGENT_LIST } from "@/lib/agents";
import { e2ePassed, validatorApproved } from "@/lib/pipeline/verdicts";
import { EXAMPLE_REQUESTS, buildReplayRun, findRecording, framesFrom, maxRound, viewsAt } from "@/lib/run";

describe("recordings", () => {
  it("has all eight agents, in pipeline order, with real text, for every example", () => {
    expect(recordings.examples.length).toBeGreaterThan(0);
    for (const ex of recordings.examples) {
      expect(ex.steps.map((s) => s.agent)).toEqual(AGENT_LIST.map((a) => a.id));
      for (const s of ex.steps) {
        expect(s.text.length).toBeGreaterThan(20);
        expect(s.ms).toBeGreaterThan(0);
      }
    }
  });

  it("stores verdict flags that agree with the recorded text", () => {
    for (const ex of recordings.examples) {
      const text = (agent: string) => ex.steps.find((s) => s.agent === agent)!.text;
      expect(ex.e2eOk).toBe(e2ePassed(text("e2e")));
      expect(ex.approved).toBe(validatorApproved(text("validator")));
    }
  });
});

describe("findRecording", () => {
  it("matches ignoring case, spacing and trailing punctuation", () => {
    const first = EXAMPLE_REQUESTS[0];
    expect(findRecording(first)).toBeDefined();
    expect(findRecording(`  ${first.toUpperCase()}!! `)).toBe(findRecording(first));
  });
  it("returns nothing for an idea that was not recorded", () => {
    expect(findRecording("Add dark mode")).toBeUndefined();
  });
});

describe("buildReplayRun", () => {
  const run = buildReplayRun(findRecording(EXAMPLE_REQUESTS[0])!);
  const step = (agent: string) => run.steps.find((s) => s.agent === agent)!;

  it("runs backend and frontend at the same time and everything else in order", () => {
    expect(step("backend").start).toBe(step("frontend").start);
    const order = ["researcher", "story", "pm", "backend", "e2e", "validator", "release"].map((a) => step(a).start);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(step("e2e").start).toBeGreaterThanOrEqual(Math.max(step("backend").end, step("frontend").end));
  });

  it("ends after the last stage and keeps the real timings for display", () => {
    expect(run.total).toBeGreaterThan(step("release").end);
    expect(run.mode).toBe("replay");
    expect(run.realMs).toBeGreaterThan(run.steps.reduce((m, s) => Math.max(m, s.ms), 0));
  });
});

describe("viewsAt and framesFrom", () => {
  const run = buildReplayRun(findRecording(EXAMPLE_REQUESTS[0])!);

  it("shows nothing before the start, and every agent finished at the end", () => {
    expect(viewsAt(run, -1)).toEqual([]);
    expect(framesFrom(viewsAt(run, run.total)).every((f) => f.status === "done")).toBe(true);
  });

  it("reveals text in proportion to progress while an agent is active", () => {
    const first = run.steps[0];
    const mid = viewsAt(run, (first.start + first.end) / 2)[0];
    expect(mid.status).toBe("active");
    expect(mid.text.length).toBeGreaterThan(0);
    expect(mid.text.length).toBeLessThan(first.text.length);
  });

  it("lists all eight agents as pending when nothing has started", () => {
    const frames = framesFrom([]);
    expect(frames).toHaveLength(8);
    expect(frames.every((f) => f.status === "pending")).toBe(true);
  });

  it("prefers the latest round when an agent ran twice", () => {
    const views = [
      { agent: "backend" as const, round: 1, model: "m", text: "one", status: "done" as const },
      { agent: "backend" as const, round: 2, model: "m", text: "two", status: "active" as const },
    ];
    const backend = framesFrom(views).find((f) => f.agent === "backend")!;
    expect(backend.round).toBe(2);
    expect(backend.text).toBe("two");
    expect(maxRound(views)).toBe(2);
  });
});
