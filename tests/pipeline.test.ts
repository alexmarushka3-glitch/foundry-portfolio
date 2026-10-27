import { describe, expect, it, vi } from "vitest";
import { costOf, runPipeline, type LlmClient } from "@/lib/pipeline";
import { MAX_RUN_COST_USD } from "@/lib/pipeline/config";
import { serverState } from "@/lib/server/state";
import type { FoundryEvent } from "@/lib/types";
import { FIXTURE_REQUEST, fixtureRecording } from "./fixtures/liveRecording";

vi.mock("@/lib/liveRecordings.json", async () => {
  const { fixtureRecording } = await import("./fixtures/liveRecording");
  return { default: { recordings: [fixtureRecording()] } };
});

async function run(request: string, opts: Parameters<typeof runPipeline>[2] = {}) {
  const events: FoundryEvent[] = [];
  await runPipeline(request, (e) => events.push(e), { pace: 0, ...opts });
  return events;
}
const of = <T extends FoundryEvent["type"]>(events: FoundryEvent[], type: T) =>
  events.filter((e): e is Extract<FoundryEvent, { type: T }> => e.type === type);

/** A fake model client. `reply` decides what each agent says, from the system prompt. */
function fakeClient(reply: (system: string, round: number) => string, usage = { input_tokens: 100, output_tokens: 50 }) {
  const calls: string[] = [];
  const client: LlmClient = {
    messages: {
      create: vi.fn().mockResolvedValue({}),
      stream: vi.fn((params: Record<string, unknown>) => {
        const system = String(params.system);
        calls.push(system.slice(0, 22));
        const text = reply(system, calls.length);
        return {
          async *[Symbol.asyncIterator]() {
            yield { type: "content_block_delta", delta: { type: "text_delta", text } };
          },
          finalMessage: async () => ({ stop_reason: "end_turn", usage }),
        } as ReturnType<LlmClient["messages"]["stream"]>;
      }),
    },
  };
  return { client, calls };
}

describe("simulated runs", () => {
  it("run all eight agents, send the work back once, then approve", async () => {
    const events = await run("Add a nickname to tasks");
    expect(of(events, "mode")[0]).toMatchObject({ mode: "simulated" });
    expect(of(events, "verdict").map((v) => [v.gate, v.round, v.approved])).toEqual([
      ["e2e", 1, false],
      ["e2e", 2, true],
      ["validator", 2, true],
    ]);
    const started = of(events, "start").map((s) => s.agent);
    expect(new Set(started).size).toBe(8);
    expect(started.filter((a) => a === "backend")).toHaveLength(2);
    expect(of(events, "finish")[0]).toMatchObject({ rounds: 2, approved: true, costUsd: undefined });
    expect(of(events, "start").every((s) => s.model.endsWith("(simulated)"))).toBe(true);
    expect(of(events, "usage")).toHaveLength(0);
  });

  it("explain why when live was refused", async () => {
    const events = await run("Add a nickname", { allowLive: false, reason: "You have used 3 live runs." });
    expect(of(events, "mode")[0]).toEqual({ type: "mode", mode: "simulated", reason: "You have used 3 live runs." });
  });

  it("say so when live runs are paused", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-test";
    serverState().admin.livePaused = true;
    const events = await run("Add a nickname");
    expect(of(events, "mode")[0]).toMatchObject({ mode: "simulated", reason: expect.stringMatching(/paused/) });
  });

  it("stop when the visitor leaves", async () => {
    const ctrl = new AbortController();
    const events: FoundryEvent[] = [];
    const promise = runPipeline("Add a nickname", (e) => {
      events.push(e);
      if (e.type === "done" && e.agent === "researcher") ctrl.abort();
    }, { pace: 0, signal: ctrl.signal });
    await expect(promise).rejects.toThrow(/cancelled/);
    expect(of(events, "start").map((s) => s.agent)).toEqual(["researcher"]);
  });
});

describe("recorded examples", () => {
  it("replay the recording and never call a model", async () => {
    const { client } = fakeClient(() => "unused");
    const events = await run(FIXTURE_REQUEST, { client });
    expect(of(events, "mode")[0]).toMatchObject({ mode: "replay" });
    expect(of(events, "mode")).toHaveLength(1);
    expect(events.slice(1)).toEqual(fixtureRecording().events.map((e) => e.event).filter((e) => e.type !== "mode"));
    expect(of(events, "tool").length).toBeGreaterThan(0);
    expect(of(events, "finish")[0]).toMatchObject({ rounds: 1, approved: true });
    expect(client.messages.stream).not.toHaveBeenCalled();
  });
});

describe("live runs", () => {
  const passing = (system: string) =>
    system.includes("E2E Verifier") ? "E2E: PASS\nok" : system.includes("Validator") ? "VERDICT: APPROVE\n- ok" : "text";

  it("track tokens and cost per agent and report the total", async () => {
    const { client } = fakeClient(passing);
    const events = await run("Add a nickname", { client });
    expect(of(events, "mode")[0]).toMatchObject({ mode: "live" });
    const usage = of(events, "usage");
    expect(usage).toHaveLength(8);
    const total = usage.reduce((s, u) => s + u.costUsd, 0);
    expect(of(events, "finish")[0].costUsd).toBeCloseTo(total, 10);
    expect(of(events, "finish")[0]).toMatchObject({ rounds: 1, approved: true });
  });

  it("send work back when the validator says REVISE, then finish in round two", async () => {
    let validatorCalls = 0;
    const { client } = fakeClient((system) => {
      if (system.includes("E2E Verifier")) return "E2E: PASS";
      if (system.includes("Validator")) return ++validatorCalls === 1 ? "VERDICT: REVISE\n- fix it" : "VERDICT: APPROVE";
      return "text";
    });
    const events = await run("Add a nickname", { client });
    expect(of(events, "finish")[0]).toMatchObject({ rounds: 2, approved: true });
    expect(of(events, "start").filter((s) => s.agent === "release")[0].round).toBe(2);
  });

  it("stop after two rounds without approval, and report that honestly", async () => {
    const { client } = fakeClient((system) => (system.includes("E2E Verifier") ? "E2E: FAIL" : "text"));
    const events = await run("Add a nickname", { client });
    expect(of(events, "finish")[0]).toMatchObject({ rounds: 2, approved: false });
    expect(of(events, "verdict").some((v) => v.gate === "validator")).toBe(false);
  });

  it("report the rounds that actually ran when the time budget cuts the second round", async () => {
    const { client } = fakeClient((system) => (system.includes("E2E Verifier") ? "E2E: FAIL" : "text"));
    let clock = 1_000;
    vi.spyOn(Date, "now").mockImplementation(() => clock);
    const events: FoundryEvent[] = [];
    await runPipeline(
      "Add a nickname",
      (e) => {
        events.push(e);
        if (e.type === "verdict") clock += 80_000; // the first round took 80 seconds
      },
      { pace: 0, client },
    );
    expect(of(events, "finish")[0]).toMatchObject({ rounds: 1, approved: false });
    expect(of(events, "start").filter((s) => s.agent === "release")[0].round).toBe(1);
  });

  it("fall back to the simulation when the preflight check fails", async () => {
    const { client } = fakeClient(passing);
    client.messages.create = vi.fn().mockRejectedValue(Object.assign(new Error("credit"), { status: 400 }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const events = await run("Add a nickname", { client });
    expect(of(events, "mode")[0]).toMatchObject({ mode: "simulated", reason: expect.stringMatching(/isn't available/) });
    expect(client.messages.stream).not.toHaveBeenCalled();
  });

  it("stop a run that has spent too much", async () => {
    const { client } = fakeClient(passing, { input_tokens: 5_000_000, output_tokens: 0 });
    await expect(run("Add a nickname", { client })).rejects.toThrow(/spending limit/);
    expect(MAX_RUN_COST_USD).toBeLessThan(1);
  });

  it("turn a refusal into a message for the visitor", async () => {
    const { client } = fakeClient(passing);
    client.messages.stream = vi.fn(() => ({
      async *[Symbol.asyncIterator]() {},
      finalMessage: async () => ({ stop_reason: "refusal", usage: { input_tokens: 1, output_tokens: 1 } }),
    })) as unknown as LlmClient["messages"]["stream"];
    await expect(run("Add a nickname", { client })).rejects.toThrow(/declined/);
  });
});

describe("costOf", () => {
  it("prices tokens per million and assumes the dearest model for unknown ones", () => {
    expect(costOf("claude-sonnet-5-5", 1_000_000, 1_000_000)).toBe(12);
    expect(costOf("claude-haiku-5-5", 1_000_000, 0)).toBeCloseTo(0.1);
    expect(costOf("mystery-model", 1_000_000, 0)).toBe(10);
  });
});
