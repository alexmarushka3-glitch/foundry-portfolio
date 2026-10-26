import { costOf, MAX_RUN_COST_USD, MAX_TOOL_TURNS, modelParams } from "./config";
import type { AgentSpec } from "./prompts";
import { sleep } from "./replay";
import { simulate } from "./simulate";
import type { BrowserReport, BrowserRunner, TestRunner } from "./sandbox";
import { MAX_BROWSER_RUNS, MAX_TEST_RUNS, RUN_BROWSER_TEST_TOOL, RUN_TESTS_TOOL, runTool, toolsFor } from "./tools";
import type { Workspace } from "./workspace";
import type { Emit } from "../types";

/** The slice of the Anthropic SDK the pipeline uses. Tests pass a fake that matches it. */
export interface LlmClient {
  messages: {
    create(params: Record<string, unknown>): Promise<unknown>;
    stream(
      params: Record<string, unknown>,
      options?: { signal?: AbortSignal },
    ): AsyncIterable<{ type: string; delta?: { type?: string; text?: string } }> & {
      finalMessage(): Promise<{
        stop_reason: string | null;
        usage: { input_tokens: number; output_tokens: number };
        /** Present on real responses. Fakes in tests may leave it out, which means "no tool calls". */
        content?: Array<{ type: string; id?: string; name?: string; input?: unknown }>;
      }>;
    };
  };
}

export type RunContext = {
  client: LlmClient | null;
  emit: Emit;
  request: string;
  /** The copy of the sample app the agents' tools work on. */
  workspace: Workspace;
  /** Runs the real tests in a sandbox. Absent in simulations and in tests that do not need it. */
  testRunner?: TestRunner;
  /** Drives a real browser in a sandbox. Absent in simulations and in tests that do not need it. */
  browserRunner?: BrowserRunner;
  /** What the E2E Verifier's browser runs found this run, so the pipeline can judge by the real result. */
  browser?: { runs: number; last?: BrowserReport };
  /** Running total of what live calls have cost, in dollars. */
  spend: { usd: number };
  signal?: AbortSignal;
  /** Delay between simulated chunks and stages; 0 in tests. */
  pace: number;
};

export class RunCancelled extends Error {
  constructor() {
    super("The run was cancelled.");
    this.name = "RunCancelled";
  }
}

/** Run one agent for one round: a live model call, or scripted text. Returns the agent's full output. */
export async function runAgent(
  ctx: RunContext,
  spec: AgentSpec,
  round: number,
  /** Text, or a function that builds it after `prelude` has run (so the input can include what the prelude found). */
  inputOrBuild: string | (() => string),
  /** Work to do right after the agent starts, shown under that agent: the E2E step uses it to run the real tests. */
  prelude?: () => Promise<void>,
): Promise<string> {
  const { client, emit, signal } = ctx;
  if (signal?.aborted) throw new RunCancelled();
  const t0 = Date.now();
  emit({ type: "start", agent: spec.name, round, model: client ? spec.model : `${spec.model} (simulated)` });

  if (prelude) await prelude();
  const input = typeof inputOrBuild === "function" ? inputOrBuild() : inputOrBuild;

  let out = "";
  if (client) {
    if (ctx.spend.usd > MAX_RUN_COST_USD) throw new Error("This run hit its spending limit and was stopped.");
    const tools = toolsFor(spec.name, Boolean(ctx.testRunner), Boolean(ctx.browserRunner));
    let testRuns = 0;
    let browserRuns = 0;
    const messages: unknown[] = [{ role: "user", content: input }];
    for (let turn = 0; ; turn++) {
      if (ctx.spend.usd > MAX_RUN_COST_USD) throw new Error("This run hit its spending limit and was stopped.");
      // On the last allowed turn the agent must answer in text: tools stay defined but cannot be chosen.
      const lastTurn = turn >= MAX_TOOL_TURNS - 1;
      const stream = client.messages.stream(
        {
          model: spec.model,
          system: spec.system,
          messages,
          ...(tools ? { tools, ...(lastTurn ? { tool_choice: { type: "none" } } : {}) } : {}),
          ...modelParams(spec.model, spec.maxTokens),
        },
        { signal },
      );
      if (turn > 0 && out && !out.endsWith("\n")) {
        out += "\n";
        emit({ type: "token", agent: spec.name, round, text: "\n" });
      }
      for await (const ev of stream) {
        if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta" && ev.delta.text) {
          out += ev.delta.text;
          emit({ type: "token", agent: spec.name, round, text: ev.delta.text });
        }
      }
      const final = await stream.finalMessage();
      if (final.stop_reason === "refusal") {
        throw new Error("The model declined this request. Try describing the feature differently.");
      }
      const cost = costOf(spec.model, final.usage.input_tokens, final.usage.output_tokens);
      ctx.spend.usd += cost;
      emit({
        type: "usage",
        agent: spec.name,
        round,
        inputTokens: final.usage.input_tokens,
        outputTokens: final.usage.output_tokens,
        costUsd: cost,
      });

      const calls = (final.content ?? []).filter((b) => b.type === "tool_use");
      if (final.stop_reason === "max_tokens") emit({ type: "tool", agent: spec.name, round, label: "output limit reached, answer cut off", ok: false });
      if (final.stop_reason !== "tool_use" || calls.length === 0) break;

      const results = [];
      for (const call of calls) {
        let r: { ok: boolean; text: string; label: string };
        if (call.name === RUN_TESTS_TOOL.name && ctx.testRunner && toolsFor(spec.name, true)?.some((t) => t.name === call.name)) {
          if (testRuns >= MAX_TEST_RUNS) {
            r = { ok: false, text: `You have already run the tests ${MAX_TEST_RUNS} times. Finish without running them again.`, label: "run_tests (limit reached)" };
          } else {
            testRuns += 1;
            const report = await ctx.testRunner(ctx.workspace.changes(), signal);
            r = { ok: report.ok, text: `${report.summary}
${report.output}`, label: report.summary };
          }
        } else if (call.name === RUN_BROWSER_TEST_TOOL.name && ctx.browserRunner && toolsFor(spec.name, false, true)?.some((t) => t.name === call.name)) {
          if (browserRuns >= MAX_BROWSER_RUNS) {
            r = { ok: false, text: `You have already run the browser test ${MAX_BROWSER_RUNS} times. Finish with the last real result.`, label: "run_browser_test (limit reached)" };
          } else {
            browserRuns += 1;
            const spec_ = typeof (call.input as { spec?: unknown } | null)?.spec === "string" ? (call.input as { spec: string }).spec : "";
            const report = await ctx.browserRunner(ctx.workspace.changes(), spec_, signal);
            if (ctx.browser) {
              ctx.browser.runs += 1;
              ctx.browser.last = report;
            }
            report.shots.forEach((s) => emit({ type: "shot", agent: spec.name, round, label: s.label, png: s.png }));
            r = { ok: report.ok, text: `${report.summary}\n${report.output}`, label: report.summary };
          }
        } else {
          r = runTool(ctx.workspace, spec.name, call.name ?? "", call.input);
        }
        emit({ type: "tool", agent: spec.name, round, label: r.label, ok: r.ok });
        results.push({ type: "tool_result", tool_use_id: call.id, content: r.text, ...(r.ok ? {} : { is_error: true }) });
      }
      messages.push({ role: "assistant", content: final.content }, { role: "user", content: results });
    }
  } else {
    out = simulate(spec.name, round, ctx.request);
    for (const chunk of out.match(/.{1,6}/gs) ?? []) {
      if (signal?.aborted) throw new RunCancelled();
      emit({ type: "token", agent: spec.name, round, text: chunk });
      if (ctx.pace > 0) await sleep(10 * ctx.pace);
    }
    if (ctx.pace > 0) await sleep(200 * ctx.pace);
  }

  emit({ type: "done", agent: spec.name, round, ms: Date.now() - t0 });
  return out;
}
