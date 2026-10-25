import { costOf, MAX_RUN_COST_USD, modelParams } from "./config";
import type { AgentSpec } from "./prompts";
import { sleep } from "./replay";
import { simulate } from "./simulate";
import type { Emit } from "../types";

/** The slice of the Anthropic SDK the pipeline uses. Tests pass a fake that matches it. */
export interface LlmClient {
  messages: {
    create(params: Record<string, unknown>): Promise<unknown>;
    stream(
      params: Record<string, unknown>,
      options?: { signal?: AbortSignal },
    ): AsyncIterable<{ type: string; delta?: { type?: string; text?: string } }> & {
      finalMessage(): Promise<{ stop_reason: string | null; usage: { input_tokens: number; output_tokens: number } }>;
    };
  };
}

export type RunContext = {
  client: LlmClient | null;
  emit: Emit;
  request: string;
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
export async function runAgent(ctx: RunContext, spec: AgentSpec, round: number, input: string): Promise<string> {
  const { client, emit, signal } = ctx;
  if (signal?.aborted) throw new RunCancelled();
  const t0 = Date.now();
  emit({ type: "start", agent: spec.name, round, model: client ? spec.model : `${spec.model} (simulated)` });

  let out = "";
  if (client) {
    if (ctx.spend.usd > MAX_RUN_COST_USD) throw new Error("This run hit its spending limit and was stopped.");
    const stream = client.messages.stream(
      {
        model: spec.model,
        system: spec.system,
        messages: [{ role: "user", content: input }],
        ...modelParams(spec.model, spec.maxTokens),
      },
      { signal },
    );
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
