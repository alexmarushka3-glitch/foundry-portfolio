import type { AgentName } from "../types";

// Scripted output so the demo works with no API key. Round 1 fails an E2E flow so
// visitors see work get sent back, then round 2 passes and the Validator approves.
// This is labelled "Simulated" everywhere it is shown. It is never presented as model output.

const lines = (...l: string[]) => l.join("\n");

export function simulate(agent: AgentName, round: number, request: string): string {
  const topic = request.length > 60 ? request.slice(0, 57) + "..." : request;
  const firstRound = round === 1;
  switch (agent) {
    case "researcher":
      return lines(
        "- db/schema.sql: single 'tasks' table (id, title, done, created_at)",
        "- src/api/tasks.ts: GET, POST and PATCH /tasks, no input validation",
        "- src/ui/TaskList.tsx: renders title and checkbox only",
        "- tests/e2e: none; unit tests cover db helpers only",
        `Gaps: nothing yet supports "${topic}".`,
      );
    case "story":
      return lines(
        `As a taskly user, I want to ${topic.charAt(0).toLowerCase()}${topic.slice(1)} so that I can manage my work faster.`,
        "1. The change works for new and existing tasks.",
        "2. Invalid input is rejected with a clear error.",
        "3. The list updates without a page reload.",
      );
    case "pm":
      return lines(
        "Data: migration adds one nullable column to tasks; existing rows unaffected.",
        "API: extend POST and PATCH /tasks to accept the field; validate type and length.",
        "UI: update TaskList.tsx to show and edit the field; add empty and error states.",
      );
    case "backend":
      return firstRound
        ? lines(
            "```sql",
            "ALTER TABLE tasks ADD COLUMN extra TEXT;",
            "```",
            "```ts",
            "const { title, extra } = req.body;",
            "db.insert('tasks', { title, extra, done: 0, created_at: now() });",
            "```",
            "Notes: migration and route updated; PATCH not yet validated.",
          )
        : lines(
            "```sql",
            "ALTER TABLE tasks ADD COLUMN extra TEXT;",
            "```",
            "```ts",
            "if (extra !== undefined && typeof extra !== 'string') return res.status(400).json({ error: 'invalid' });",
            "db.update('tasks', req.params.id, { extra });",
            "```",
            "Notes: added validation on PATCH after the failed flow.",
          );
    case "frontend":
      return firstRound
        ? lines("```tsx", "<li key={t.id}>{t.title} <span>{t.extra}</span></li>", "```", "Notes: shows the field; editing comes next.")
        : lines(
            "```tsx",
            "<li key={t.id}>{t.title}",
            "  <input value={t.extra ?? ''} onChange={e => save(t.id, e.target.value)} />",
            "  {error && <p role='alert'>{error}</p>}",
            "</li>",
            "```",
            "Notes: added inline editing plus an error state.",
          );
    case "e2e":
      return lines(
        firstRound ? "E2E: FAIL" : "E2E: PASS",
        "Flow 1, create task with the new field: PASS",
        "Flow 2, view list after reload: PASS",
        `Flow 3, edit the field on an existing task: ${firstRound ? "FAIL (no edit control in the UI)" : "PASS"}`,
      );
    case "validator":
      return lines(
        "VERDICT: APPROVE",
        "- Criteria 1 to 3 met; E2E flows all pass.",
        "- Input validated server side; migration is additive and safe.",
      );
    case "release":
      return `Add: ${topic}\n- Data: additive migration, no downtime\n- API: validated POST and PATCH changes\n- UI: inline editing with error state; E2E flows pass`;
  }
}
