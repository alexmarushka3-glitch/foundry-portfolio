import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FoundryEvent } from "@/lib/types";

// The route is tested against a stand-in pipeline, so these tests cover the HTTP layer: validation,
// limits, streaming, logging and cancellation, without waiting for a real or simulated run.
const pipeline = vi.hoisted(() => ({ runPipeline: vi.fn(), live: false }));
vi.mock("@/lib/pipeline", () => ({
  runPipeline: pipeline.runPipeline,
  liveEnabled: () => pipeline.live,
}));

vi.mock("@/lib/liveRecordings.json", async () => {
  const { fixtureRecording } = await import("./fixtures/liveRecording");
  return { default: { recordings: [fixtureRecording()] } };
});

import { GET, POST } from "@/app/api/run/route";
import { serverState } from "@/lib/server/state";

const idea = (text: string) => ({ idea: text });
const NICK = idea("A tip calculator for friends");

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
    for (const body of [
      "{nope",
      {},
      { request: "   " },
      { request: "x".repeat(201) },
      { request: "free text that is not an example" },
      { idea: "hi" },
      { idea: "x".repeat(161) },
      { idea: "A login page that saves passwords" },
    ]) {
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
    const [logged] = await serverState().runLog.list();
    expect(logged).toMatchObject({
      request: "A tip calculator for friends",
      mode: "simulated",
      status: "approved",
      rounds: 1,
    });
    expect(logged.visitor).toHaveLength(8);
    expect(JSON.stringify(logged)).not.toContain("203.0.113.9");
  });

  it("sends an error event and logs an error when the pipeline throws, and hides raw API errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    pipeline.runPipeline.mockRejectedValue(new Error("401 invalid x-api-key sk-ant-secret"));
    const res = await post(NICK);
    const events = await readLines(res);
    const err = events.find((e) => e.type === "error");
    expect(err).toMatchObject({
      message: "The run stopped before it finished. Try again in a moment.",
    });
    expect((await serverState().runLog.list())[0].status).toBe("error");
  });
});

describe("POST /api/run limits", () => {
  const optionsOf = () =>
    pipeline.runPipeline.mock.calls.at(-1)![2] as { allowLive: boolean; reason?: string };

  const browser = (id: string) => `foundry_b=${id.padEnd(20, "0")}`;

  it("counts only typed ideas against the visitor limit, and falls back to simulation with a reason", async () => {
    pipeline.live = true;
    process.env.FOUNDRY_LIVE_PER_HOUR = "1";
    const headers = { "x-forwarded-for": "198.51.100.7", cookie: browser("alice") };
    await (await post(idea("A habit tracker one"), headers)).text();
    expect(optionsOf().allowLive).toBe(true);
    await (await post(idea("A habit tracker two"), headers)).text();
    expect(optionsOf()).toMatchObject({
      allowLive: false,
      reason: expect.stringMatching(/1 live runs this hour/),
    });
    // a different visitor still gets a live run
    await (await post(idea("A habit tracker three"), { "x-forwarded-for": "198.51.100.8" })).text();
    expect(optionsOf().allowLive).toBe(true);
  });

  it("gives each browser on a shared network its own runs, up to the network's hourly cap", async () => {
    pipeline.live = true;
    process.env.FOUNDRY_LIVE_PER_HOUR = "1";
    process.env.FOUNDRY_LIVE_PER_NETWORK_HOUR = "2";
    const wifi = "203.0.113.50";
    await (
      await post(idea("Idea one"), { "x-forwarded-for": wifi, cookie: browser("bob") })
    ).text();
    expect(optionsOf().allowLive).toBe(true);
    await (
      await post(idea("Idea two"), { "x-forwarded-for": wifi, cookie: browser("carol") })
    ).text();
    expect(optionsOf().allowLive).toBe(true);
    await (
      await post(idea("Idea three"), { "x-forwarded-for": wifi, cookie: browser("dave") })
    ).text();
    expect(optionsOf()).toMatchObject({
      allowLive: false,
      reason: expect.stringMatching(/network.*2 live runs this hour/),
    });
  });

  it("gives a browser without an id a cookie, and keeps one it already has", async () => {
    const fresh = await post(idea("Cookie one"), { "x-forwarded-for": "198.51.100.9" });
    await fresh.text();
    expect(fresh.headers.get("set-cookie")).toMatch(
      /^foundry_b=[A-Za-z0-9-]{16,64}; Path=\/api;.*HttpOnly/,
    );
    const known = await post(idea("Cookie two"), {
      "x-forwarded-for": "198.51.100.9",
      cookie: browser("erin"),
    });
    await known.text();
    expect(known.headers.get("set-cookie")).toBeNull();
  });

  it("does not count recorded examples", async () => {
    pipeline.live = true;
    process.env.FOUNDRY_LIVE_PER_HOUR = "1";
    for (let i = 0; i < 3; i++)
      await (await post({ request: "Let users set a due date on tasks" })).text();
    expect((await serverState().liveLimiter.snapshot()).usedToday).toBe(0);
  });
});

describe("POST /api/run cancellation", () => {
  it("aborts the pipeline when the visitor disconnects, and logs the run as cancelled", async () => {
    let seen: AbortSignal | undefined;
    pipeline.runPipeline.mockImplementation(
      async (_r: string, emit: (e: FoundryEvent) => void, opts: { signal: AbortSignal }) => {
        seen = opts.signal;
        emit({ type: "mode", mode: "live" });
        await new Promise((resolve) => opts.signal.addEventListener("abort", resolve));
        throw new Error("cancelled");
      },
    );
    const res = await post(NICK);
    const reader = res.body!.getReader();
    await reader.read(); // first event arrives
    await reader.cancel(); // the visitor leaves
    await vi.waitFor(async () => expect(await serverState().runLog.list()).toHaveLength(1));
    expect(seen?.aborted).toBe(true);
    expect((await serverState().runLog.list())[0].status).toBe("cancelled");
  });
});
