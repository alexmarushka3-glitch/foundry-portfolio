import Anthropic from "@anthropic-ai/sdk";
import { renderSampleRepo } from "./sampleRepo";
import recordings from "./recordings.json";

export type AgentName =
  | "researcher"
  | "story"
  | "pm"
  | "backend"
  | "frontend"
  | "e2e"
  | "validator"
  | "release";

export type Gate = "e2e" | "validator";

export type FoundryEvent =
  | { type: "mode"; mode: "live" | "simulated" | "replay" }
  | { type: "start"; agent: AgentName; round: number; model: string }
  | { type: "token"; agent: AgentName; round: number; text: string }
  | { type: "done"; agent: AgentName; round: number; ms: number }
  | { type: "verdict"; gate: Gate; round: number; approved: boolean }
  | { type: "finish"; ms: number; rounds: number; approved: boolean }
  | { type: "error"; message: string };

export type Emit = (e: FoundryEvent) => void;

const MODELS = {
  smart: process.env.FOUNDRY_MODEL_SMART ?? "claude-fable-5-1",
  build: process.env.FOUNDRY_MODEL_BUILD ?? "claude-sonnet-5-5",
  fast: process.env.FOUNDRY_MODEL_FAST ?? "claude-haiku-5-5",
};

type AgentSpec = { name: AgentName; model: string; system: string; maxTokens: number };

const AGENTS: Record<AgentName, AgentSpec> = {
  researcher: {
    name: "researcher",
    model: MODELS.fast,
    maxTokens: 300,
    system:
      "You are the Researcher. You are strictly read-only: you can only read the repository text you are given and report on it. Do not propose changes. Output 4 to 6 bullets on what exists that is relevant to the request (files, tables, endpoints, components) and one line listing gaps. No preamble.",
  },
  story: {
    name: "story",
    model: MODELS.build,
    maxTokens: 300,
    system:
      "You are the Story Writer. Turn the rough idea into a user story: 'As a <user>, I want <goal> so that <value>', then 3 or 4 acceptance criteria as a numbered list. Ground it in the research. No preamble.",
  },
  pm: {
    name: "pm",
    model: MODELS.smart,
    maxTokens: 400,
    system:
      "You are the Project Manager. Write the technical blueprint from the story and research: sections 'Data' (migration), 'API' (endpoints and shapes), 'UI' (components and states), each 1 to 3 lines. Name real files from the research. No preamble.",
  },
  backend: {
    name: "backend",
    model: MODELS.build,
    maxTokens: 450,
    system:
      "You are the Backend engineer. From the blueprint, write the SQL migration and the API route changes as short code blocks (under 25 lines total). If reviewer feedback is given, fix what it names. One sentence of notes.",
  },
  frontend: {
    name: "frontend",
    model: MODELS.build,
    maxTokens: 450,
    system:
      "You are the Frontend engineer. From the blueprint, write the UI change as a short React/TSX code block (under 25 lines), including empty and error states. If feedback is given, fix what it names. One sentence of notes.",
  },
  e2e: {
    name: "e2e",
    model: MODELS.build,
    maxTokens: 350,
    system:
      "You are the E2E Verifier. Skip unit tests. Walk 2 or 3 full user flows from the story through the backend and frontend changes, step by step, marking each PASS or FAIL with a reason. The first line MUST be exactly 'E2E: PASS' or 'E2E: FAIL'. Fail only for a real broken flow.",
  },
  validator: {
    name: "validator",
    model: MODELS.smart,
    maxTokens: 300,
    system:
      "You are the Validator doing the final audit. Check every acceptance criterion in the story against the code and the E2E result, and check security and data safety. The first line MUST be exactly 'VERDICT: APPROVE' or 'VERDICT: REVISE'. Then at most 4 bullets. Approve unless a criterion is unmet or there is a real risk.",
  },
  release: {
    name: "release",
    model: MODELS.fast,
    maxTokens: 220,
    system:
      "You are the Release agent. Write a pull request: a one-line title, then a 3 bullet description covering data, API and UI. No preamble.",
  },
};

const MAX_ROUNDS = 2;

export function hasLiveKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

type Recording = (typeof recordings.examples)[number];
type RecordedStep = Recording["steps"][number];

const normalize = (s: string) => s.trim().toLowerCase().replace(/[.!?]+$/, "");

// Example requests were run for real once (see recordings-src/) and are replayed for free.
export function findRecording(request: string): Recording | undefined {
  return recordings.examples.find((e) => normalize(e.request) === normalize(request));
}

// Replays compress the real wall-clock time so visitors don't wait 90 seconds.
const REPLAY_SPEED = 0.12;

async function replay(rec: Recording, emit: Emit): Promise<void> {
  emit({ type: "mode", mode: "replay" });
  const play = async (s: RecordedStep) => {
    emit({ type: "start", agent: s.agent as AgentName, round: s.round, model: s.model });
    const span = Math.min(2800, Math.max(700, s.ms * REPLAY_SPEED));
    const chunks = s.text.match(/.{1,8}/gs) ?? [];
    for (const chunk of chunks) {
      emit({ type: "token", agent: s.agent as AgentName, round: s.round, text: chunk });
      await sleep(span / chunks.length);
    }
    emit({ type: "done", agent: s.agent as AgentName, round: s.round, ms: s.ms });
  };
  const step = (name: string) => rec.steps.find((s) => s.agent === name)!;

  await play(step("researcher"));
  await play(step("story"));
  await play(step("pm"));
  await Promise.all([play(step("backend")), play(step("frontend"))]);
  await play(step("e2e"));
  emit({ type: "verdict", gate: "e2e", round: 1, approved: rec.e2eOk });
  await play(step("validator"));
  emit({ type: "verdict", gate: "validator", round: 1, approved: rec.approved });
  await play(step("release"));
  emit({ type: "finish", ms: rec.totalMs, rounds: rec.rounds, approved: rec.approved });
}

export async function runPipeline(request: string, emit: Emit): Promise<void> {
  const recorded = findRecording(request);
  if (recorded) return replay(recorded, emit);

  const t0 = Date.now();
  const live = hasLiveKey();
  emit({ type: "mode", mode: live ? "live" : "simulated" });

  const client = live ? new Anthropic() : null;
  const step = (agent: AgentName, round: number, input: string) =>
    runAgent(client, AGENTS[agent], round, request, input, emit);

  const research = await step(
    "researcher",
    1,
    `Request: ${request}\n\nRepository (read-only):\n${renderSampleRepo()}`,
  );
  const story = await step("story", 1, `Rough idea: ${request}\n\nResearch:\n${research}`);
  const blueprint = await step("pm", 1, `Story:\n${story}\n\nResearch:\n${research}`);

  let feedback = "";
  let backend = "";
  let frontend = "";
  let approved = false;
  let round = 1;
  for (; round <= MAX_ROUNDS; round++) {
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
  emit({ type: "finish", ms: Date.now() - t0, rounds: round, approved });
}

async function runAgent(
  client: Anthropic | null,
  spec: AgentSpec,
  round: number,
  request: string,
  input: string,
  emit: Emit,
): Promise<string> {
  const t0 = Date.now();
  emit({ type: "start", agent: spec.name, round, model: client ? spec.model : `${spec.model} (simulated)` });

  let out = "";
  if (client) {
    const stream = client.messages.stream({
      model: spec.model,
      max_tokens: spec.maxTokens,
      system: spec.system,
      messages: [{ role: "user", content: input }],
    });
    for await (const ev of stream) {
      if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") {
        out += ev.delta.text;
        emit({ type: "token", agent: spec.name, round, text: ev.delta.text });
      }
    }
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
        ? [
            "```tsx",
            "<li key={t.id}>{t.title} <span>{t.extra}</span></li>",
            "```",
            "Notes: shows the field; editing comes next.",
          ].join("\n")
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
