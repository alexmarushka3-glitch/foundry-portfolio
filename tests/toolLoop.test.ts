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
    expect(withTools).toEqual(["Backend", "Frontend", "Researcher"]);
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
