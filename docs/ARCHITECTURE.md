# Architecture

How the code is organised, how a run flows through it, and where to change things. For setup and day-to-day commands, see the [README](../README.md).

## Layers

```
app/                     Next.js routes only: pages and HTTP handlers. Thin; they call into lib/.
  page.tsx               The public page.
  admin/                 The admin dashboard page (server-gated) and its CSS.
  api/run/               GET: is live on? POST: stream a run as NDJSON.
  admin-demo/            Public sample-data copy of the dashboard. No token, no server data.
  api/admin/{login,logout,stats,actions}/   Admin API. Every route except login needs the session cookie.

components/              React UI.
  Stage.tsx              The live agent view. Owns the state and wires the pieces below together.
  stage/                 Its parts: IdeaForm, OutputPanel, PlayerControls, and hooks
                         (usePlayback, useLiveRun, useMediaQuery, useLiveAvailability, useOnceInView).
  PipelineSvg.tsx        Draws the eight-agent pipeline.
  admin/                 Dashboard: AdminDashboard, KpiCards, FilterBar, RunsTable, ControlPanel, charts, useAdminData.

lib/                     Everything that isn't React or HTTP.
  types.ts               Shared types: AgentName, FoundryEvent (the stream protocol), Mode.
  agents.ts              Labels and one-line jobs for the eight agents (what the page shows).
  run.ts                 Recordings, replay timeline, frames at a moment. Browser and server safe.
  liveRun.ts             Pure reducer that builds a run from streamed events. Browser safe.
  ndjson.ts              Encode and read the event stream.
  format.ts, summary.ts  Display helpers.
  pipeline/              The eight agents. Server only.
  server/                Server state: rate limits, run log, admin auth, env parsing. Server only.
  admin/                 Dashboard maths (aggregate.ts), the stats payload (overview.ts), action names.
  recordings.json        GENERATED from recordings-src/. Never hand-edit.

tests/                   Vitest. One file per area; see "Tests" below.
recordings-src/          Raw outputs of the three real recorded runs.
scripts/                 build-recordings.mjs.
```

Rule of thumb: `lib/` files marked "browser safe" import nothing from `lib/server/` or `node:*`. The admin dashboard imports only *types* from `lib/server/runLog`, which TypeScript erases.

## A run, end to end

1. The browser decides what to do (`components/Stage.tsx`, `go()`).
   - The idea matches a recording (`findRecording`): play it in the browser with `buildReplayRun` and `viewsAt`. No network.
   - Otherwise: `useLiveRun` POSTs `{ request }` to `/api/run`.
2. `app/api/run/route.ts` validates the request (`parseRequest`: a `spec` from `lib/spec.ts` is rebuilt into one sentence server-side; plain text is accepted only for the recorded examples), checks the per-visitor and daily brake (`LiveLimiter`) for typed ideas, and starts `runPipeline` inside a `ReadableStream`. Each event goes to two places: the response (one JSON object per line) and a `RunRecorder` that will become the admin log entry.
3. `lib/pipeline/index.ts` `runPipeline`:
   - recorded idea: `replayOnServer` (kept for API clients);
   - live allowed and a key is set: a one-token preflight, then real model calls. A new `Workspace` (`workspace.ts`) is made for the run. The Researcher and the two engineers get tools (`tools.ts`) and `agentRunner.ts` loops until they stop calling tools; each call is sent as a `tool` event. The checking agents are given the files the engineers wrote;
   - otherwise: scripted text from `simulate.ts`.
   
   The order is fixed: researcher, story, PM, then up to two rounds of (backend and frontend in parallel, E2E verifier, validator), then release. If E2E fails, or the validator says REVISE, round two starts with that feedback. Verdicts are read by `verdicts.ts`.
4. Back in the browser, `useLiveRun` feeds each line to `applyEvent` (batched to one render per frame). When `finish` arrives, `toRun` makes a scrubbable `Run`, and the same player used for replays takes over.
5. When the response ends, the route adds the finished record to `RunLog` (status `cancelled` if the visitor left first).

### The event stream

`FoundryEvent` in `lib/types.ts` is the contract between server and page: `mode`, `start`, `token`, `done`, `usage`, `verdict`, `finish`, `error`. Add a field there first and TypeScript will point at every place that needs updating.

### Cancellation and spending

The route aborts an `AbortController` when the visitor disconnects. The signal reaches the SDK request and the simulation loop, so a live run stops spending. A run also stops by itself past `MAX_RUN_COST_USD` ($0.60), caps each agent at `MAX_TOOL_TURNS` model calls, and never starts round two after `ROUND_TIME_BUDGET_MS` (75 s). These live in `lib/pipeline/config.ts`.

## Server state

`lib/server/state.ts` keeps one object on `globalThis` (so dev hot reloads don't wipe it): the run log, the live limiter, the login limiter, and the admin pause switch. It is **in memory, per server instance**. On Vercel each warm instance has its own copy and a cold start resets it. That is fine for a brake and for a recent-activity view; it is not a database. If you need durable history or exact counts, replace `RunLog` and `LiveLimiter` with versions backed by Redis or Postgres. Their small public methods (`add/list/clear`, `check/reset/snapshot`) are the seam.

## Admin dashboard

- **Gate:** `ADMIN_TOKEN`. Unset means `/admin` and `/api/admin/*` return 404. Set means a sign-in form; the token is compared in constant time, attempts are limited to five per address per 15 minutes, and the session is an HTTP-only, SameSite=Strict cookie holding an HMAC derived from the token (changing the token signs everyone out).
- **Data:** `GET /api/admin/stats` returns recent runs, server settings and the recorded examples. The page filters, sorts, paginates and charts in the browser with the pure functions in `lib/admin/aggregate.ts`, so every number is unit tested.
- **Actions:** `POST /api/admin/actions` with `pause-live`, `resume-live`, `reset-limits` or `clear-log`. Each returns the fresh overview.
- **Two front doors, one view:** `components/admin/AdminView.tsx` draws the dashboard from an `AdminData` object (`useAdminData.ts`) and does not know where it came from. `AdminDashboard` feeds it from the server (`/admin`, signed in). `DemoDashboard` feeds it from `useDemoData.ts` and `lib/admin/sampleData.ts` (`/admin-demo`, and a compact `embedded` version in the home page's "Watching the factory run" section, loaded lazily by `DashboardSection`; public, made-up data, no network). Anything shown on `/admin-demo` must stay clearly labelled as sample data.
- **Privacy:** the log stores a short hash of the visitor address, never the address. It stores the idea text visitors typed.

## Honesty constraints that shape the code

- `recordings-src/` and `lib/recordings.json` are real output; the build script is the only writer of the JSON.
- Every mode is labelled on the page. Simulated text is never shown as model output (`MODE_COPY` in `Stage.tsx`, `runSummary` in `lib/summary.ts`).
- `lib/reality.ts` and the project copy in `lib/profile.ts` must keep the caveats listed in `CLAUDE.md`.

## Tests

`npm test` runs everything in about three seconds. No test calls a real model or needs a key.

| File | Covers |
| --- | --- |
| `pipeline.test.ts` | Simulated, replayed and live runs (with a fake model client): rounds, verdicts, cost, spending cap, preflight fallback, refusal, time budget, cancellation. |
| `runRoute.test.ts` | The run API: validation, NDJSON streaming, limits, logging, error hiding, disconnect handling. |
| `Stage.test.tsx` | The critical page flows in jsdom: replay, typed idea, server error, dropped connection, rejected request. |
| `admin.test.ts` | Sign-in, lockout, cookie, every admin route and action. |
| `sampleData.test.ts`, `DemoDashboard.test.tsx` | The sample data is repeatable, labelled and complete; the public demo makes no requests and its controls work on screen only. |
| `aggregate.test.ts`, `runLog.test.ts` | Dashboard maths and the run log. |
| `rateLimit.test.ts`, `runApi.test.ts`, `ndjson.test.ts`, `liveRun.test.ts`, `run.test.ts`, `verdicts.test.ts`, `format.test.ts` | The smaller building blocks, including the integrity of the recordings. |

Pipeline tests pass `pace: 0` to skip the simulation's delays and `client` to inject a fake model.

## Recipes

**Change an agent's instructions or model:** edit `lib/pipeline/prompts.ts` (and `MODELS` in `config.ts`). Update `lib/agents.ts` only if its on-page description changes.

**Add an agent:** add its name to `AgentName` (`types.ts`), a row to `AGENT_LIST`, a spec in `prompts.ts`, a case in `simulate.ts`, a node and edges in `PipelineSvg.tsx`, and a step in `runPipeline` and `buildReplayRun`. The recordings would need re-recording.

**Add a recorded example:** see "Adding a recorded example" in `CLAUDE.md`.

**Add an admin card or chart:** compute it in `lib/admin/aggregate.ts` with a test, then render it in `AdminDashboard.tsx`.

**Add an admin action:** add its name to `lib/admin/actions.ts`, handle it in `app/api/admin/actions/route.ts`, add a button in `ControlPanel.tsx`, and a case in `tests/admin.test.ts`.

**Move server state to a database:** implement the same methods as `RunLog` and `LiveLimiter` and construct them in `lib/server/state.ts`.
