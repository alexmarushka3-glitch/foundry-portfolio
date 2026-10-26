import { serverState } from "../server/state";

// Live runs default to the cheaper models. Override with env vars to try bigger ones.
// Recorded runs used Haiku 5.5, Sonnet 5.5 and Fable 5.1; their model names are stored with them.
export const MODELS = {
  smart: process.env.FOUNDRY_MODEL_SMART ?? "claude-sonnet-5-5",
  build: process.env.FOUNDRY_MODEL_BUILD ?? "claude-sonnet-5-5",
  fast: process.env.FOUNDRY_MODEL_FAST ?? "claude-haiku-5-5",
};

// Dollars per million tokens: [input, output]. From the Claude API reference, cached Oct 2026.
const PRICES: Record<string, [number, number]> = {
  "claude-fable-5-1": [10, 50],
  "claude-opus-5-5": [4, 20],
  "claude-sonnet-5-5": [2, 10],
  "claude-haiku-5-5": [0.1, 0.5],
};
const WORST_CASE_PRICE: [number, number] = [10, 50]; // unknown model: assume the dearest

export const costOf = (model: string, inputTokens: number, outputTokens: number): number => {
  const [pin, pout] = PRICES[model] ?? WORST_CASE_PRICE;
  return (inputTokens * pin + outputTokens * pout) / 1_000_000;
};

/** A run that has spent more than this stops. Tool use makes runs dearer than the old text-only ones. */
export const MAX_RUN_COST_USD = 0.6;

/** Most model calls one agent may make while it reads and writes files. The last one cannot use tools. */
export const MAX_TOOL_TURNS = 8;

/** The first attempt plus one send-back. */
export const MAX_ROUNDS = 2;

/** Never start a second round if the first one already ran this long. */
export const ROUND_TIME_BUDGET_MS = 75_000;

/**
 * Live runs need a key on the server. They can be switched off with FOUNDRY_LIVE=off,
 * or paused from the admin dashboard.
 */
export function liveConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY) && process.env.FOUNDRY_LIVE !== "off";
}

export function liveEnabled(): boolean {
  return liveConfigured() && !serverState().admin.livePaused;
}

/**
 * Per-model request settings. These models think by default, and thinking tokens count against
 * max_tokens, so without this a short answer can be cut off or come back empty.
 */
export function modelParams(model: string, maxTokens: number) {
  if (model.startsWith("claude-fable")) {
    // Thinking can't be turned off on Fable. Keep it shallow and leave room for it.
    return { max_tokens: maxTokens + 1500, output_config: { effort: "low" as const } };
  }
  if (model.startsWith("claude-haiku")) {
    return { max_tokens: maxTokens, thinking: { type: "disabled" as const }, output_config: { effort: "low" as const } };
  }
  // Sonnet 5.5 and similar: "between_tools" is the supported way to keep thinking off.
  return { max_tokens: maxTokens, thinking: { type: "between_tools" as const }, output_config: { effort: "low" as const } };
}
