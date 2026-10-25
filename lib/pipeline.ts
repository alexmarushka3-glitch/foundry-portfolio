import Anthropic from "@anthropic-ai/sdk";
import { renderSampleRepo } from "./sampleRepo";
import { findRecording, buildReplayRun } from "./run";
import type { AgentName, Emit } from "./types";

export type { AgentName, FoundryEvent, Emit, Gate, Mode } from "./types";

// Live runs default to the cheaper models. Override with env vars to try bigger ones.
// Recorded runs used Haiku 5.5, Sonnet 5.5 and Fable 5.1; their model names are stored with them.
const MODELS = {
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

// A run that spends more than this stops. A normal run costs a few cents.
const MAX_RUN_COST_USD = 0.25;

type AgentSpec = { name: AgentName; model: string; system: string; maxTokens: number };

const AGENTS: Record<AgentName, AgentSpec> = {
  researcher: {
    name: "researcher",
    model: MODELS.fast,
    maxTokens: 400,
    system:
      "You are the Researcher. You are strictly read-only: you can only read the repository text you are given and report on it. Do not propose changes. Output 4 to 6 bullets on what exists that is relevant to the request (files, tables, endpoints, components) and one line listing gaps. No preamble.",
  },
  story: {
    name: "story",
    model: MODELS.build,
    maxTokens: 450,
    system:
      "You are the Story Writer. Turn the rough idea into a user story: 'As a <user>, I want <goal> so that <value>', then 3 or 4 acceptance criteria as a numbered list. Ground it in the research. No preamble.",
  },
  pm: {
    name: "pm",
    model: MODELS.smart,
    maxTokens: 900,
    system:
      "You are the Project Manager. Write the technical blueprint from the story and research: sections 'Data' (migration), 'API' (endpoints and shapes), 'UI' (components and states), each 1 to 3 lines. Name real files from the research. No preamble.",
  },
  backend: {
    name: "backend",
    model: MODELS.build,
    maxTokens: 900,
    system:
      "You are the Backend engineer. From the blueprint, write the SQL migration and the API route changes as short code blocks (under 25 lines total). Show only new or changed code, never whole files. If reviewer feedback is given, fix what it names. One sentence of notes.",
  },
  frontend: {
    name: "frontend",
    model: MODELS.build,
    maxTokens: 1100,
    system:
      "You are the Frontend engineer. From the blueprint, write the UI change as a short React/TSX code block (under 25 lines), including empty and error states. Show only new or changed code, never whole files, and finish every code block you start. If feedback is given, fix what it names. One sentence of notes.",
  },
  e2e: {
    name: "e2e",
    model: MODELS.build,
    maxTokens: 800,
    system:
      "You are the E2E Verifier. Skip unit tests. Walk 2 or 3 full user flows from the story through the backend and frontend changes, step by step, marking each PASS or FAIL with a reason. Judge only the code shown: the rest of the app exists as the story and code describe it, so do not fail a flow for files or helpers that are simply not shown. The first line MUST be exactly 'E2E: PASS' or 'E2E: FAIL'. Fail only when the code shown breaks a flow.",
  },
  validator: {
    name: "validator",
    model: MODELS.smart,
    maxTokens: 700,
    system:
      "You are the Validator doing the final audit. Check every acceptance criterion in the story against the code and the E2E result, and check security and data safety. The first line MUST be exactly 'VERDICT: APPROVE' or 'VERDICT: REVISE'. Then at most 4 bullets. Approve unless a criterion is unmet or there is a real risk.",
  },
  release: {
    name: "release",
    model: MODELS.fast,
    maxTokens: 350,
    system:
      "You are the Release agent. Write a pull request: a one-line title, then a 3 bullet description covering data, API and UI. No preamble.",
  },
};

const MAX_ROUNDS = 2;

/** Live runs need a key on the server, and can be switched off with FOUNDRY_LIVE=off. */
export function liveEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY) && process.env.FOUNDRY_LIVE !== "off";
}

/**
 * Per-model request settings. These models think by default, and thinking tokens count against
 * max_tokens, so without this a short answer can be cut off or come back empty.
 */
function modelParams(model: string, maxTokens: number) {
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

export type RunOptions = { allowLive?: boolean; reason?: string };

export async function runPipeline(request: string, emit: Emit, opts: RunOptions = {}): Promise<void> {
  const recorded = findRecording(request);
  if (recorded) return replayOnServer(recorded, emit);

  const t0 = Date.now();
  const live = liveEnabled() && opts.allowLive !== false;
  emit({ type: "mode", mode: live ? "live" : "simulated", reason: live ? undefined : opts.reason });

  const client = live ? new Anthropic() : null;
  const spend = { usd: 0 };
  const step = (agent: AgentName, round: number, input: string) =>
    runAgent(client, AGENTS[agent], round, request, input, emit, spend);

  const research = await step("researcher", 1, `Request: ${request}\n\nRepository (read-only):\n${renderSampleRepo()}`);
  const story = await step("story", 1, `Rough idea: ${request}\n\nResearch:\n${research}`);
  const blueprint = await step("pm", 1, `Story:\n${story}\n\nResearch:\n${research}`);

  let feedback = "";
  let backend = "";
  let frontend = "";
  let approved = false;
  let round = 1;
  for (; round <= MAX_ROUNDS; round++) {
    // Never start a second round if the first one already ran long.
    if (round > 1 && Date.now() - t0 > 75_000) break;
    const fb = feedback ? `\n\nFeedback to address:\n${feedback}` : "";
    [backend, frontend] = await Promise.all([
      step("backend", round, `Blueprint:\n${blueprint}${fb}\n\nPrevious backend code:\n${backend}`),
      step("frontend", round, `Blueprint:\n${blueprint}${fb}\n\nPrevious frontend code:\n${frontend}`),
    ]);

    const flows = await step("e2e", round, `Story:\n${story}\n\nBackend:\n${backend}\n\nFrontend:\n${frontend}`);
    const flowsPass = /E2E:\s*PASS/i.test(flows);
    emit({ type: "verdict", gate: "e2e", round, approved: flowsPass });
    if (!flowsPass) {
      feedback = flows;
      if (round === MAX_ROUNDS) break;
      continue;
    }

    const audit = await step(
      "validator",
      round,
      `Story:\n${story}\n\nBackend:\n${backend}\n\nFrontend:\n${frontend}\n\nE2E result:\n${flows}`,
    );
    approved = /VERDICT:\s*APPROVE/i.test(audit);
    emit({ type: "verdict", gate: "validator", round, approved });
    if (approved) break;
    feedback = audit;
  }
  round = Math.min(round, MAX_ROUNDS);

  await step(
    "release",
    round,
    `Request: ${request}\n\nBlueprint:\n${blueprint}\n\nBackend:\n${backend}\n\nFrontend:\n${frontend}\n\nApproved: ${approved}`,
  );
  emit({ type: "finish", ms: Date.now() - t0, rounds: round, approved, costUsd: live ? spend.usd : undefined });
}

async function runAgent(
  client: Anthropic | null,
  spec: AgentSpec,
  round: number,
  request: string,
  input: string,
  emit: Emit,
  spend: { usd: number },
): Promise<string> {
  const t0 = Date.now();
  emit({ type: "start", agent: spec.name, round, model: client ? spec.model : `${spec.model} (simulated)` });

  let out = "";
  if (client) {
    if (spend.usd > MAX_RUN_COST_USD) throw new Error("This run hit its spending limit and was stopped.");
    const stream = client.messages.stream({
      model: spec.model,
      system: spec.system,
      messages: [{ role: "user", content: input }],
      ...modelParams(spec.model, spec.maxTokens),
    });
    for await (const ev of stream) {
      if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") {
        out += ev.delta.text;
        emit({ type: "token", agent: spec.name, round, text: ev.delta.text });
      }
    }
    const final = await stream.finalMessage();
    if (final.stop_reason === "refusal") {
      throw new Error("The model declined this request. Try describing the feature differently.");
    }
    const cost = costOf(spec.model, final.usage.input_tokens, final.usage.output_tokens);
    spend.usd += cost;
    emit({ type: "usage", agent: spec.name, round, inputTokens: final.usage.input_tokens, outputTokens: final.usage.output_tokens, costUsd: cost });
  } else {
    out = simulate(spec.name, round, request);
    for (const chunk of out.match(/.{1,6}/gs) ?? []) {
      emit({ type: "token", agent: spec.name, round, text: chunk });
      await sleep(10);
    }
    await sleep(200);
  }

  emit({ type: "done", agent: spec.name, round, ms: Date.now() - t0 });
  return out;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Server-side replay, kept for API clients. The page itself replays recordings in the browser.
async function replayOnServer(rec: NonNullable<ReturnType<typeof findRecording>>, emit: Emit): Promise<void> {
  const run = buildReplayRun(rec);
  emit({ type: "mode", mode: "replay" });
  const t0 = Date.now();
  const byStart = [...run.steps].sort((a, b) => a.start - b.start);
  for (const s of byStart) {
    const wait = s.start - (Date.now() - t0);
    if (wait > 0) await sleep(wait);
    emit({ type: "start", agent: s.agent, round: s.round, model: s.model });
    const chunks = s.text.match(/.{1,8}/gs) ?? [];
    const span = Math.max(1, s.end - s.start);
    for (const c of chunks) {
      emit({ type: "token", agent: s.agent, round: s.round, text: c });
      await sleep(span / chunks.length);
    }
    emit({ type: "done", agent: s.agent, round: s.round, ms: s.ms });
    if (s.agent === "e2e") emit({ type: "verdict", gate: "e2e", round: s.round, approved: rec.e2eOk });
    if (s.agent === "validator") emit({ type: "verdict", gate: "validator", round: s.round, approved: rec.approved });
  }
  emit({ type: "finish", ms: rec.totalMs, rounds: rec.rounds, approved: rec.approved });
}

// Scripted output so the demo works with no API key. Round 1 fails an E2E flow so
// visitors see work get sent back, then round 2 passes and the Validator approves.
function simulate(agent: AgentName, round: number, request: string): string {
  const topic = request.length > 60 ? request.slice(0, 57) + "..." : request;
  switch (agent) {
    case "researcher":
      return [
        "- db/schema.sql: single 'tasks' table (id, title, done, created_at)",
        "- src/api/tasks.ts: GET, POST and PATCH /tasks, no input validation",
        "- src/ui/TaskList.tsx: renders title and checkbox only",
        "- tests/e2e: none; unit tests cover db helpers only",
        `Gaps: nothing yet supports "${topic}".`,
      ].join("\n");
    case "story":
      return [
        `As a taskly user, I want to ${topic.charAt(0).toLowerCase()}${topic.slice(1)} so that I can manage my work faster.`,
        "1. The change works for new and existing tasks.",
        "2. Invalid input is rejected with a clear error.",
        "3. The list updates without a page reload.",
      ].join("\n");
    case "pm":
      return [
        "Data: migration adds one nullable column to tasks; existing rows unaffected.",
        "API: extend POST and PATCH /tasks to accept the field; validate type and length.",
        "UI: update TaskList.tsx to show and edit the field; add empty and error states.",
      ].join("\n");
    case "backend":
      return round === 1
        ? [
            "```sql",
            "ALTER TABLE tasks ADD COLUMN extra TEXT;",
            "```",
            "```ts",
            "const { title, extra } = req.body;",
            "db.insert('tasks', { title, extra, done: 0, created_at: now() });",
            "```",
            "Notes: migration and route updated; PATCH not yet validated.",
          ].join("\n")
        : [
            "```sql",
            "ALTER TABLE tasks ADD COLUMN extra TEXT;",
            "```",
            "```ts",
            "if (extra !== undefined && typeof extra !== 'string') return res.status(400).json({ error: 'invalid' });",
            "db.update('tasks', req.params.id, { extra });",
            "```",
            "Notes: added validation on PATCH after the failed flow.",
          ].join("\n");
    case "frontend":
      return round === 1
        ? ["```tsx", "<li key={t.id}>{t.title} <span>{t.extra}</span></li>", "```", "Notes: shows the field; editing comes next."].join("\n")
        : [
            "```tsx",
            "<li key={t.id}>{t.title}",
            "  <input value={t.extra ?? ''} onChange={e => save(t.id, e.target.value)} />",
            "  {error && <p role='alert'>{error}</p>}",
            "</li>",
            "```",
            "Notes: added inline editing plus an error state.",
          ].join("\n");
    case "e2e":
      return round === 1
        ? [
            "E2E: FAIL",
            "Flow 1, create task with the new field: PASS",
            "Flow 2, view list after reload: PASS",
            "Flow 3, edit the field on an existing task: FAIL (no edit control in the UI)",
          ].join("\n")
        : [
            "E2E: PASS",
            "Flow 1, create task with the new field: PASS",
            "Flow 2, view list after reload: PASS",
            "Flow 3, edit the field on an existing task: PASS",
          ].join("\n");
    case "validator":
      return [
        "VERDICT: APPROVE",
        "- Criteria 1 to 3 met; E2E flows all pass.",
        "- Input validated server side; migration is additive and safe.",
      ].join("\n");
    case "release":
      return `Add: ${topic}\n- Data: additive migration, no downtime\n- API: validated POST and PATCH changes\n- UI: inline editing with error state; E2E flows pass`;
  }
}
