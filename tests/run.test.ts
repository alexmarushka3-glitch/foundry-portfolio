import { describe, expect, it, vi } from "vitest";
import { framesFrom, maxRound, normalizeRequest, viewsAt, type Run } from "@/lib/run";
import { loadLiveRecordings } from "@/lib/liveReplay";

vi.mock("@/lib/liveRecordings.json", async () => {
  const { fixtureRecording } = await import("./fixtures/liveRecording");
  return { default: { recordings: [fixtureRecording()] } };
});
vi.mock("@/lib/exampleRequests", async () => {
  const { FIXTURE_REQUEST } = await import("./fixtures/liveRecording");
  return { EXAMPLE_REQUESTS: [FIXTURE_REQUEST] };
});

describe("live recordings", () => {
  it("loads once and hands back the same list", async () => {
    expect(await loadLiveRecordings()).toBe(await loadLiveRecordings());
  });
});

describe("normalizeRequest", () => {
  it("ignores case, outer spacing and trailing punctuation", () => {
    expect(normalizeRequest("  Add a Due Date!! ")).toBe(normalizeRequest("add a due date"));
  });
});

describe("viewsAt and framesFrom", () => {
  const run: Run = {
    request: "x",
    mode: "replay",
    steps: [
      { agent: "researcher", round: 1, model: "m", text: "Reading the repository and its tests.", start: 0, end: 1000, ms: 5000 },
      { agent: "story", round: 1, model: "m", text: "As a user I want a due date.", start: 1450, end: 2450, ms: 4000 },
    ],
    total: 3150,
    approved: true,
    rounds: 1,
    realMs: 9000,
  };

  it("shows nothing before the start, and every started agent is finished at the end", () => {
    expect(viewsAt(run, -1)).toEqual([]);
    const frames = framesFrom(viewsAt(run, run.total));
    expect(frames.filter((f) => f.status === "done")).toHaveLength(run.steps.length);
    expect(frames.filter((f) => f.status === "active")).toHaveLength(0);
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
