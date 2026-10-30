import { describe, expect, it, vi } from "vitest";
import { runPipeline, type LlmClient } from "@/lib/pipeline";
import { MAX_TOOL_TURNS } from "@/lib/pipeline/config";
import type { FoundryEvent } from "@/lib/types";

type Block = { type: string; id?: string; name?: string; input?: unknown; text?: string };

/**
 * A fake model that uses tools. `script` is given the agent (from its system prompt) and the number of
 * model calls that agent has made so far in this conversation, and returns either text or tool calls.
 */
function toolClient(script: (agent: string, turn: number, messages: unknown[]) => Block[]) {
  const seen: Array<{ agent: string; params: Record<string, unknown> }> = [];
  const agentOf = (system: string) =>
    ["Researcher", "Story Writer", "Project Manager", "Backend", "Frontend", "E2E Verifier", "Validator", "Release"].find((a) =>
      system.includes(`You are the ${a}`),
    ) ?? "?";
  const client: LlmClient = {
    messages: {
      create: vi.fn().mockResolvedValue({}),
      stream: vi.fn((params: Record<string, unknown>) => {
        const agent = agentOf(String(params.system));
        const messages = params.messages as unknown[];
        const turn = (messages.length - 1) / 2;
        seen.push({ agent, params });
        const content = script(agent, turn, messages);
        const usesTools = content.some((b) => b.type === "tool_use");
        return {
          async *[Symbol.asyncIterator]() {
            for (const b of content) if (b.type === "text") yield { type: "content_block_delta", delta: { type: "text_delta", text: b.text } };
          },
          finalMessage: async () => ({
            stop_reason: usesTools ? "tool_use" : "end_turn",
            usage: { input_tokens: 100, output_tokens: 50 },
            content,
          }),
        } as ReturnType<LlmClient["messages"]["stream"]>;
      }),
    },
  };
  return { client, seen };
}

const text = (t: string): Block[] => [{ type: "text", text: t }];
const tool = (id: string, name: string, input: unknown): Block => ({ type: "tool_use", id, name, input });

async function run(client: LlmClient) {
  const events: FoundryEvent[] = [];
  await runPipeline("Add a nickname", (e) => events.push(e), { pace: 0, client });
  return events;
}

const verdicts = (agent: string): Block[] | null =>
  agent === "E2E Verifier" ? text("E2E: PASS") : agent === "Validator" ? text("VERDICT: APPROVE\n- ok") : null;

describe("tool loop", () => {
  it("lets agents read and write files, feeds results back, and shows the calls", async () => {
    const { client, seen } = toolClient((agent, turn, messages) => {
      const v = verdicts(agent);
      if (v) return v;
      if (agent === "Researcher") return turn === 0 ? [tool("t1", "read_file", { path: "src/db.js" })] : text("- db.js has a tasks table");
      if (agent === "Backend") {
        return turn === 0
          ? [tool("b1", "read_file", { path: "src/db.js" }), tool("b2", "write_file", { path: "src/db.js", content: "// new db\n" })]
          : text("Changed db.js.");
      }
      if (agent === "Frontend") return turn === 0 ? [tool("f1", "write_file", { path: "src/db.js", content: "// not mine" })] : text("Tried.");
      void messages;
      return text(agent);
    });
    const events = await run(client);

    // the researcher's tool result went back to the model as a tool_result for the same call id
    const researcherSecond = seen.filter((s) => s.agent === "Researcher")[1].params.messages as Array<{ role: string; content: unknown }>;
    expect(researcherSecond).toHaveLength(3);
    expect(JSON.stringify(researcherSecond[2].content)).toContain('"tool_use_id":"t1"');
    expect(JSON.stringify(researcherSecond[2].content)).toContain("CREATE TABLE");

    const tools = events.filter((e): e is Extract<FoundryEvent, { type: "tool" }> => e.type === "tool");
    expect(tools.map((t) => [t.agent, t.label, t.ok])).toEqual([
      ["researcher", "read_file src/db.js", true],
      ["backend", "read_file src/db.js", true],
      ["backend", "write_file src/db.js", true],
      ["frontend", "write_file src/db.js (not allowed)", false],
    ]);

    // the checking agents see the real files the backend wrote
    const e2e = seen.find((s) => s.agent === "E2E Verifier")!.params.messages as Array<{ content: string }>;
    expect(e2e[0].content).toContain("--- src/db.js ---\n// new db");
    expect(e2e[0].content).not.toContain("not mine");
  });

  it("offers tools only to the agents that have them", async () => {
    const { client, seen } = toolClient((agent) => verdicts(agent) ?? text("ok"));
    await run(client);
    const withTools = [...new Set(seen.filter((s) => s.params.tools).map((s) => s.agent))].sort();
    expect(withTools).toEqual(["Backend", "E2E Verifier", "Frontend", "Researcher"]);
    // without a sandbox nobody is offered the tools that need one
    expect(seen.every((s) => !JSON.stringify(s.params.tools ?? []).match(/run_tests|run_browser_test/))).toBe(true);
  });

  it("makes an agent that keeps calling tools answer in text on its last turn", async () => {
    const { client, seen } = toolClient((agent, turn, messages) => {
      const v = verdicts(agent);
      if (v) return v;
      if (agent === "Researcher") {
        const choice = (seen.at(-1)!.params.tool_choice as { type?: string } | undefined)?.type;
        void messages;
        return choice === "none" ? text("- done") : [tool(`t${turn}`, "list_dir", { path: "." })];
      }
      return text("ok");
    });
    const events = await run(client);
    const researcherCalls = seen.filter((s) => s.agent === "Researcher");
    expect(researcherCalls).toHaveLength(MAX_TOOL_TURNS);
    expect(researcherCalls.at(-1)!.params.tool_choice).toEqual({ type: "none" });
    expect(researcherCalls[0].params.tool_choice).toBeUndefined();
    expect(events.some((e) => e.type === "finish")).toBe(true);
  });

  it("charges every model call to the run's cost", async () => {
    const { client } = toolClient((agent, turn) => {
      const v = verdicts(agent);
      if (v) return v;
      return agent === "Researcher" && turn === 0 ? [tool("t1", "list_dir", { path: "." })] : text("ok");
    });
    const events = await run(client);
    const usage = events.filter((e) => e.type === "usage");
    expect(usage).toHaveLength(9); // eight agents plus the researcher's extra turn
  });
});

describe("real test runs", () => {
  const report = (ok: boolean, ran = true) => ({ ran, ok, summary: ok ? "npm test: 5 passed, 0 failed" : "npm test: 3 passed, 2 failed", output: "details", ms: 5 });
  const passingScript = (agent: string): Block[] | null => verdicts(agent);

  async function runWith(testRunner: TestRunnerType, script = passingScript) {
    const { client, seen } = toolClient((agent, turn) => script(agent) ?? (agent === "Backend" && turn === 0 ? [tool("r1", "run_tests", {})] : text("ok")));
    const events: FoundryEvent[] = [];
    await runPipeline("Add a nickname", (e) => events.push(e), { pace: 0, client, testRunner });
    return { events, seen };
  }
  type TestRunnerType = NonNullable<Parameters<typeof runPipeline>[2]>["testRunner"];

  it("offers run_tests to the engineers only when a runner exists, and returns its report to them", async () => {
    const runner = vi.fn(async () => report(true));
    const { events, seen } = await runWith(runner);
    const toolNames = (agent: string) => (seen.find((s) => s.agent === agent)!.params.tools as Array<{ name: string }>).map((t) => t.name);
    expect(toolNames("Backend")).toContain("run_tests");
    expect(toolNames("Researcher")).not.toContain("run_tests");
    const labels = events.filter((e): e is Extract<FoundryEvent, { type: "tool" }> => e.type === "tool").map((t) => `${t.agent}: ${t.label}`);
    expect(labels).toContain("backend: npm test: 5 passed, 0 failed");
    expect(labels).toContain("e2e: npm test: 5 passed, 0 failed");
    const second = seen.filter((s) => s.agent === "Backend")[1].params.messages as Array<{ content: unknown }>;
    expect(JSON.stringify(second[2].content)).toContain("5 passed");
  });

  it("does not offer run_tests when there is no runner", async () => {
    const { seen } = await runWith(undefined as unknown as TestRunnerType);
    expect(seen.every((s) => !JSON.stringify(s.params.tools ?? []).includes("run_tests"))).toBe(true);
  });

  it("fails the E2E gate when the real tests fail, even if the E2E agent says PASS, and sends the work back", async () => {
    let calls = 0;
    const runner = vi.fn(async () => report(++calls > 2)); // fails during round 1, passes from round 2
    const { events } = await runWith(runner);
    const gates = events.filter((e): e is Extract<FoundryEvent, { type: "verdict" }> => e.type === "verdict" && e.gate === "e2e");
    expect(gates[0]).toMatchObject({ round: 1, approved: false });
    expect(gates.at(-1)).toMatchObject({ approved: true });
    expect(events.find((e) => e.type === "finish")).toMatchObject({ rounds: 2, approved: true });
  });

  it("does not block a run when the sandbox itself is unavailable, and says so", async () => {
    const runner = vi.fn(async () => report(false, false));
    const { events, seen } = await runWith(runner);
    expect(events.find((e) => e.type === "finish")).toMatchObject({ rounds: 1, approved: true });
    const validator = seen.find((s) => s.agent === "Validator")!.params.messages as Array<{ content: string }>;
    expect(validator[0].content).toContain("sandbox was unavailable");
  });

  it("stops an agent from running the tests more than twice", async () => {
    const runner = vi.fn(async () => report(true));
    const { client } = toolClient((agent, turn) => verdicts(agent) ?? (agent === "Backend" && turn < 3 ? [tool(`r${turn}`, "run_tests", {})] : text("ok")));
    const events: FoundryEvent[] = [];
    await runPipeline("Add a nickname", (e) => events.push(e), { pace: 0, client, testRunner: runner });
    const backendRuns = events.filter((e) => e.type === "tool" && e.agent === "backend" && e.label.startsWith("npm test"));
    expect(backendRuns).toHaveLength(2);
    expect(events.some((e) => e.type === "tool" && e.label === "run_tests (limit reached)")).toBe(true);
  });
});

describe("real browser runs", () => {
  const tests = { ran: true, ok: true, summary: "npm test: 5 passed, 0 failed", output: "", ms: 3 };
  const shot = { label: "adds a task", png: "iVBORw0KGgo=" };
  const browserReport = (ok: boolean, ran = true) => ({
    ran,
    ok,
    summary: ok ? "real browser: 2 passed, 0 failed" : "real browser: 1 passed, 1 failed",
    output: "output",
    ms: 9,
    shots: ran ? [shot] : [],
  });
  type Opts = NonNullable<Parameters<typeof runPipeline>[2]>;

  async function runWith(browserRunner: Opts["browserRunner"], verifierRuns = true) {
    const { client, seen } = toolClient((agent, turn) => {
      if (agent === "E2E Verifier") {
        // the verifier's text always claims PASS: the real result must decide
        return verifierRuns && turn === 0 ? [tool("e1", "run_browser_test", { spec: "test('x', async () => {})" }), ...text("")] : text("E2E: PASS\nchecked");
      }
      return verdicts(agent) ?? text("ok");
    });
    const events: FoundryEvent[] = [];
    await runPipeline("Add a nickname", (e) => events.push(e), { pace: 0, client, testRunner: async () => tests, browserRunner });
    return { events, seen };
  }
  const finish = (events: FoundryEvent[]) => events.find((e) => e.type === "finish");
  const gates = (events: FoundryEvent[]) => events.filter((e): e is Extract<FoundryEvent, { type: "verdict" }> => e.type === "verdict" && e.gate === "e2e");

  it("gives the verifier the browser tool, passes the spec to the runner, and streams the pictures", async () => {
    const runner = vi.fn(async () => browserReport(true));
    const { events, seen } = await runWith(runner);
    expect(runner).toHaveBeenCalledWith(expect.any(Object), "test('x', async () => {})", undefined);
    expect(JSON.stringify(seen.find((s) => s.agent === "E2E Verifier")!.params.tools)).toContain("run_browser_test");
    expect(events.filter((e) => e.type === "shot")).toEqual([{ type: "shot", agent: "e2e", round: 1, label: "adds a task", png: "iVBORw0KGgo=" }]);
    expect(finish(events)).toMatchObject({ rounds: 1, approved: true });
  });

  it("fails the gate when the real browser fails, even if the verifier says PASS, and sends the work back", async () => {
    let n = 0;
    const { events } = await runWith(vi.fn(async () => browserReport(++n > 1)));
    expect(gates(events)[0]).toMatchObject({ round: 1, approved: false });
    expect(finish(events)).toMatchObject({ rounds: 2, approved: true });
  });

  it("fails the gate when the verifier never ran the browser", async () => {
    const runner = vi.fn(async () => browserReport(true));
    const { events } = await runWith(runner, false);
    expect(runner).not.toHaveBeenCalled();
    expect(gates(events).every((g) => !g.approved)).toBe(true);
    expect(finish(events)).toMatchObject({ rounds: 2, approved: false });
  });

  it("does not block the run when the browser itself could not start", async () => {
    const { events } = await runWith(vi.fn(async () => browserReport(false, false)));
    expect(finish(events)).toMatchObject({ rounds: 1, approved: true });
  });

  it("stops the verifier after three browser runs", async () => {
    const runner = vi.fn(async () => browserReport(false));
    const { client } = toolClient((agent, turn) => (agent === "E2E Verifier" && turn < 5 ? [tool(`e${turn}`, "run_browser_test", { spec: "x" })] : verdicts(agent) ?? text("ok")));
    const events: FoundryEvent[] = [];
    await runPipeline("Add a nickname", (e) => events.push(e), { pace: 0, client, testRunner: async () => tests, browserRunner: runner });
    expect(runner).toHaveBeenCalledTimes(6); // three per round, two rounds
    expect(events.some((e) => e.type === "tool" && e.label === "run_browser_test (limit reached)")).toBe(true);
  });
});

describe("opening the pull request", () => {
  type Opts = NonNullable<Parameters<typeof runPipeline>[2]>;
  const tests = { ran: true, ok: true, summary: "npm test: 5 passed, 0 failed", output: "", ms: 3 };

  async function runWith(github: Opts["github"], approve = true) {
    const { client } = toolClient((agent, turn) => {
      if (agent === "Backend" && turn === 0) return [tool("w1", "write_file", { path: "src/db.js", content: "// new\n" })];
      if (agent === "Validator") return text(approve ? "VERDICT: APPROVE" : "VERDICT: REVISE\n- no");
      if (agent === "E2E Verifier") return text("E2E: PASS");
      if (agent === "Release") return text("Add nickname field\n- Data: x");
      return text("ok");
    });
    const events: FoundryEvent[] = [];
    await runPipeline("Add a nickname", (e) => events.push(e), { pace: 0, client, testRunner: async () => tests, github });
    return events;
  }

  it("opens a draft pull request with the written files after an approved run, and tells the page", async () => {
    const github = { openPullRequest: vi.fn(async () => ({ url: "https://github.com/x/y/pull/9", number: 9 })), closeStale: vi.fn() };
    const events = await runWith(github);
    expect(github.openPullRequest).toHaveBeenCalledTimes(1);
    const call = (github.openPullRequest.mock.calls[0] as unknown as [{ files: Record<string, string>; title: string }])[0];
    expect(call.files).toEqual({ "src/db.js": "// new\n" });
    expect(call.title).toBe("Add nickname field");
    expect(events.find((e) => e.type === "pr")).toEqual({ type: "pr", url: "https://github.com/x/y/pull/9", number: 9 });
    expect(events.findIndex((e) => e.type === "pr")).toBeLessThan(events.findIndex((e) => e.type === "finish"));
  });

  it("hands the page the approved app's changed files, before the finish", async () => {
    const events = await runWith(undefined);
    expect(events.find((e) => e.type === "files")).toEqual({ type: "files", files: { "src/db.js": "// new\n" } });
    expect(events.findIndex((e) => e.type === "files")).toBeLessThan(events.findIndex((e) => e.type === "finish"));
  });

  it("hands over no files when the run was not approved", async () => {
    const events = await runWith(undefined, false);
    expect(events.some((e) => e.type === "files")).toBe(false);
  });

  it("opens nothing when the run did not pass both checks", async () => {
    const github = { openPullRequest: vi.fn(), closeStale: vi.fn() };
    const events = await runWith(github, false);
    expect(github.openPullRequest).not.toHaveBeenCalled();
    expect(events.some((e) => e.type === "pr")).toBe(false);
    expect(events.some((e) => e.type === "tool" && /did not pass both checks/.test(e.label))).toBe(true);
    expect(events.find((e) => e.type === "finish")).toMatchObject({ approved: false });
  });

  it("finishes the run normally when GitHub fails, and says no pull request was opened", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const github = { openPullRequest: vi.fn().mockRejectedValue(new Error("GitHub POST /pulls failed (500)")), closeStale: vi.fn() };
    const events = await runWith(github);
    expect(events.some((e) => e.type === "pr")).toBe(false);
    expect(events.some((e) => e.type === "tool" && /no pull request opened \(GitHub unavailable\)/.test(e.label))).toBe(true);
    expect(events.find((e) => e.type === "finish")).toMatchObject({ approved: true });
  });
});
