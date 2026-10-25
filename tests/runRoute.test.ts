import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FoundryEvent } from "@/lib/types";

// The route is tested against a stand-in pipeline, so these tests cover the HTTP layer: validation,
// limits, streaming, logging and cancellation, without waiting for a real or simulated run.
const pipeline = vi.hoisted(() => ({ runPipeline: vi.fn(), live: false }));
vi.mock("@/lib/pipeline", () => ({
  runPipeline: pipeline.runPipeline,
  liveEnabled: () => pipeline.live,
}));

import { GET, POST } from "@/app/api/run/route";
import { serverState } from "@/lib/server/state";

const fieldSpec = (name: string) => ({ spec: { kind: "field", name, valueType: "text" } });
const NICK = fieldSpec("nickname");

const post = (body: unknown, headers: Record<string, string> = {}) =>
  POST(
    new Request("http://test/api/run", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

const readLines = async (res: Response) =>
  (await res.text())
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as FoundryEvent);

const happyRun = async (_req: string, emit: (e: FoundryEvent) => void) => {
  emit({ type: "mode", mode: "simulated" });
  emit({ type: "done", agent: "story", round: 1, ms: 12 });
  emit({ type: "finish", ms: 100, rounds: 1, approved: true });
};

beforeEach(() => {
  pipeline.live = false;
  pipeline.runPipeline.mockReset();
  pipeline.runPipeline.mockImplementation(happyRun);
});

describe("GET /api/run", () => {
  it("reports whether live runs are on", async () => {
    pipeline.live = true;
    expect(await (await GET()).json()).toEqual({ live: true });
  });
});

describe("POST /api/run validation", () => {
  it("rejects bad JSON, empty ideas and long ideas with a 400 and a message", async () => {
    for (const body of ["{nope", {}, { request: "   " }, { request: "x".repeat(201) }, { request: "free text that is not an example" }, { spec: { kind: "nope", name: "x" } }, { spec: { kind: "field", name: "bad;name", valueType: "text" } }]) {
      const res = await post(body);
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBeTruthy();
    }
    expect(pipeline.runPipeline).not.toHaveBeenCalled();
  });
});

describe("POST /api/run streaming", () => {
  it("streams the pipeline's events as one JSON object per line", async () => {
    const res = await post(NICK);
    expect(res.headers.get("content-type")).toContain("application/x-ndjson");
    expect((await readLines(res)).map((e) => e.type)).toEqual(["mode", "done", "finish"]);
  });

  it("logs the finished run for the admin dashboard, with a hashed visitor", async () => {
    const res = await post(NICK, { "x-forwarded-for": "203.0.113.9" });
    await res.text();
    const [logged] = serverState().runLog.list();
    expect(logged).toMatchObject({ request: 'Add a "nickname" field to tasks (type: text, optional).', mode: "simulated", status: "approved", rounds: 1 });
    expect(logged.visitor).toHaveLength(8);
    expect(JSON.stringify(logged)).not.toContain("203.0.113.9");
  });

  it("sends an error event and logs an error when the pipeline throws, and hides raw API errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    pipeline.runPipeline.mockRejectedValue(new Error("401 invalid x-api-key sk-ant-secret"));
    const res = await post(NICK);
    const events = await readLines(res);
    const err = events.find((e) => e.type === "error");
    expect(err).toMatchObject({ message: "The run stopped before it finished. Try again in a moment." });
    expect(serverState().runLog.list()[0].status).toBe("error");
  });
});

describe("POST /api/run limits", () => {
  const optionsOf = () => pipeline.runPipeline.mock.calls.at(-1)![2] as { allowLive: boolean; reason?: string };

  it("counts only typed ideas against the visitor limit, and falls back to simulation with a reason", async () => {
    pipeline.live = true;
    process.env.FOUNDRY_LIVE_PER_HOUR = "1";
    const headers = { "x-forwarded-for": "198.51.100.7" };
    await (await post(fieldSpec("idea one"), headers)).text();
    expect(optionsOf().allowLive).toBe(true);
    await (await post(fieldSpec("idea two"), headers)).text();
    expect(optionsOf()).toMatchObject({ allowLive: false, reason: expect.stringMatching(/1 live runs this hour/) });
    // a different visitor still gets a live run
    await (await post(fieldSpec("idea three"), { "x-forwarded-for": "198.51.100.8" })).text();
    expect(optionsOf().allowLive).toBe(true);
  });

  it("does not count recorded examples", async () => {
    pipeline.live = true;
    process.env.FOUNDRY_LIVE_PER_HOUR = "1";
    for (let i = 0; i < 3; i++) await (await post({ request: "Let users set a due date on tasks" })).text();
    expect(serverState().liveLimiter.snapshot().usedToday).toBe(0);
  });
});

describe("POST /api/run cancellation", () => {
  it("aborts the pipeline when the visitor disconnects, and logs the run as cancelled", async () => {
    let seen: AbortSignal | undefined;
    pipeline.runPipeline.mockImplementation(async (_r: string, emit: (e: FoundryEvent) => void, opts: { signal: AbortSignal }) => {
      seen = opts.signal;
      emit({ type: "mode", mode: "live" });
      await new Promise((resolve) => opts.signal.addEventListener("abort", resolve));
      throw new Error("cancelled");
    });
    const res = await post(NICK);
    const reader = res.body!.getReader();
    await reader.read(); // first event arrives
    await reader.cancel(); // the visitor leaves
    await vi.waitFor(() => expect(serverState().runLog.list()).toHaveLength(1));
    expect(seen?.aborted).toBe(true);
    expect(serverState().runLog.list()[0].status).toBe("cancelled");
  });
});
