// A tiny task-tracker codebase bundled with the demo. The Researcher agent reads
// this and nothing else. It is passed in as plain text, so the agent has no tools
// and cannot write or run anything: read-only by construction.

export const SAMPLE_REPO: Record<string, string> = {
  "README.md": "# taskly\nA minimal task tracker. Express API, SQLite, React UI.",
  "db/schema.sql": [
    "CREATE TABLE tasks (",
    "  id INTEGER PRIMARY KEY,",
    "  title TEXT NOT NULL,",
    "  done INTEGER NOT NULL DEFAULT 0,",
    "  created_at TEXT NOT NULL",
    ");",
  ].join("\n"),
  "src/api/tasks.ts": [
    "router.get('/tasks', (req, res) => res.json(db.all('SELECT * FROM tasks ORDER BY created_at DESC')));",
    "router.post('/tasks', (req, res) => {",
    "  const { title } = req.body;",
    "  const row = db.insert('tasks', { title, done: 0, created_at: new Date().toISOString() });",
    "  res.status(201).json(row);",
    "});",
    "router.patch('/tasks/:id', (req, res) => res.json(db.update('tasks', req.params.id, req.body)));",
  ].join("\n"),
  "src/ui/TaskList.tsx": [
    "export function TaskList({ tasks }: { tasks: Task[] }) {",
    "  return <ul>{tasks.map(t => <li key={t.id}><input type='checkbox' checked={!!t.done} />{t.title}</li>)}</ul>;",
    "}",
  ].join("\n"),
  "tests/e2e/README.md": "No end-to-end tests yet. Unit tests only cover db helpers.",
};

export function renderSampleRepo(): string {
  return Object.entries(SAMPLE_REPO)
    .map(([path, body]) => `--- ${path} ---\n${body}`)
    .join("\n\n");
}
