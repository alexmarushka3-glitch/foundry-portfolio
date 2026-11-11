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
  run.ts                 Run and step types, frames at a moment. Browser and server safe.
  liveReplay.ts          Lays a recorded live run out on a replay timeline (buildLiveReplayRun, findLiveRecording).
  liveRun.ts             Pure reducer that builds a run from streamed events. Browser safe.
  ndjson.ts              Encode and read the event stream.
  format.ts, summary.ts  Display helpers.
  pipeline/              The eight agents. Server only.
  server/                Server state: rate limits, run log, admin auth, env parsing. Server only.
  admin/                 Dashboard maths (aggregate.ts), the stats payload (overview.ts), action names.
  starter.ts             The starter kit every run begins from, and which files each engineer may write.
  bundle.ts              Inlines the app's files into one self-contained .html file (preview, save, browser test).
  spec.ts                validateIdea: checks the visitor's idea (length, words, no login or payment apps).
  liveRecordings.json    GENERATED from recordings-src/live/ (npm run recordings:live). Never hand-edit.
  exampleRequests.ts     GENERATED with it: the three example requests.

tests/                   Vitest. One file per area; see "Tests" below.
recordings-src/live/     The three real recorded live runs (full event streams). archive-taskly/ (the old to-do-app runs) and archive-text-only/ are kept for history.
scripts/                 record-live-runs.ts, build-live-recordings.mjs.
```

Rule of thumb: `lib/` files marked "browser safe" import nothing from `lib/server/` or `node:*`. The admin dashboard imports only *types* from `lib/server/runLog`, which TypeScript erases.

## A run, end to end

1. The browser decides what to do (`components/Stage.tsx`, `go()`).
   - The idea matches a recording (`findLiveRecording`): play it in the browser with `buildLiveReplayRun` and `viewsAt`. No network.
   - Otherwise: `useLiveRun` POSTs `{ idea }` to `/api/run`.
2. `app/api/run/route.ts` validates the request (`parseRequest`: an `idea` is checked with `validateIdea`; a plain `request` is accepted only for the recorded examples), checks the per-visitor and daily brake (`LiveLimiter`) for typed ideas, and starts `runPipeline` inside a `ReadableStream`. Each event goes to two places: the response (one JSON object per line) and a `RunRecorder` that will become the admin log entry.
3. `lib/pipeline/index.ts` `runPipeline`:
   - recorded idea: `replayOnServer` (kept for API clients);
   - live allowed and a key is set: a one-token preflight, then real model calls. A new `Workspace` (`workspace.ts`) holds the starter kit (`lib/starter.ts`) with the agents' writes in an overlay. The Researcher, the Logic and Interface engineers and the Browser Tester get tools (`tools.ts`) and `agentRunner.ts` loops until they stop calling tools; each call is sent as a `tool` event. If the Story Writer answers `REFUSE: <reason>`, the run stops with that reason before anything is built. The Browser Tester step starts by running the real unit tests (`sandbox.ts`: a sandbox from `FOUNDRY_SANDBOX_SNAPSHOT`, network off, old project files cleared, the app written in, `npm test`); a failing suite fails the gate. The Logic engineer can also call `run_tests` (twice). With a snapshot the Browser Tester gets `run_browser_test` (three calls): it submits a Playwright spec, and `sandbox.ts` serves the bundled single file (`bundleApp`) with a tiny Node server and runs a smoke test (an h1, no errors) plus that spec in headless Chromium, returning the real result and PNGs (`shot` events). A failing browser run fails the gate; a browser that cannot start does not block. The checking agents are given the app's files;
   - otherwise: scripted text from `simulate.ts`.
   
   The order is fixed: researcher, story, PM, then up to two rounds of (Logic and Interface in parallel, Browser Tester, Validator), then Release. If the browser check fails, or the validator says REVISE, round two starts with that feedback. Verdicts are read by `verdicts.ts`.
4. Back in the browser, `useLiveRun` feeds each line to `applyEvent` (batched to one render per frame). When `finish` arrives, `toRun` makes a scrubbable `Run`, and the same player used for replays takes over.
   A live run that passed both checks also sends a `files` event (the files the agents wrote) just before `finish`. The finished run then shows `components/stage/AppPreview.tsx`: the bundled app opens right away in `public/preview/frame.html`, a sandboxed iframe (opaque origin), where `public/preview/runner.js` adds an in-memory localStorage and writes the app into the frame. The frame's own CSP (`previewHeaders` in `lib/securityHeaders.ts`) allows no network. "Save the app" saves the same bundle, which uses the browser's real storage: through the browser's "Save as" window (`showSaveFilePicker`, Chrome and Edge) or, failing that, a download. Because some company computers block downloads, there are two more ways: "Open full screen" opens `public/preview/full.html` in a new tab (policy `fullscreenHeaders`; its `full.js` asks the opener for the html with postMessage and puts it in the same sealed iframe, giving up after 5 seconds if nobody answers), and "Copy the code" puts the file on the clipboard. "Get a link" keeps the file on the server for 7 days: `POST /api/share` checks it (`lib/server/shareCheck.ts`), counts it against the limits (`lib/server/shareBrake.ts`: 5 an hour per address, 40 a day for the site) and stores it in Upstash Redis (`lib/server/shareStore.ts`; the button is hidden without the database, and there is no memory fallback on purpose). `app/a/[id]/route.ts` serves it with `sharedAppHeaders` (`lib/securityHeaders.ts`): a CSP `sandbox` without allow-same-origin, so the page has no cookies, storage or network, plus noindex and no-store. The storage stand-in (`lib/previewShim.ts`, kept identical to `public/preview/runner.js` by a test) is injected, and the content check runs again on every open. The admin page's "App links" box (`/api/admin/share`) removes one pasted link.
5. When the response ends, the route adds the finished record to `RunLog` (status `cancelled` if the visitor left first).

### The event stream

`FoundryEvent` in `lib/types.ts` is the contract between server and page: `mode`, `start`, `token`, `tool`, `shot`, `done`, `usage`, `verdict`, `pr`, `files`, `finish`, `error`. Add a field there first and TypeScript will point at every place that needs updating.

### Cancellation and spending

The route aborts an `AbortController` when the visitor disconnects. The signal reaches the SDK request and the simulation loop, so a live run stops spending. A run also stops by itself past `MAX_RUN_COST_USD` ($0.60), caps each agent at `MAX_TOOL_TURNS` model calls, and never starts round two after `ROUND_TIME_BUDGET_MS` (100 s). These live in `lib/pipeline/config.ts`.

## Server state

`lib/server/state.ts` keeps one object on `globalThis` (so dev hot reloads don't wipe it): the run log, the live limiter, the login limiter, and the admin pause switch. The login limiter and pause switch are **in memory, per server instance**: on Vercel each warm instance has its own copy and a cold start resets it. That is fine for a brake. The run log and the live brake are different: with `KV_REST_API_URL` and `KV_REST_API_TOKEN` set, `lib/server/runStore.ts` keeps the history in Upstash Redis and `lib/server/liveBrake.ts` keeps the live-run counts there (per browser and per network per hour, and per UTC day for the site; fixed windows, address and browser id hashed; the browser id is a random value in the `foundry_b` cookie set by `/api/run`), so both survive restarts and are shared by every instance. Without those variables, or if the database errors, they fall back to memory (the brake then counts per instance, never lets every run through). Both share the small client in `lib/server/upstash.ts`.

## Admin dashboard

- **Gate:** `ADMIN_TOKEN`. Unset means `/admin` and `/api/admin/*` return 404. Set means a sign-in form; the token is compared in constant time, attempts are limited to five per address per 15 minutes, and the session is an HTTP-only, SameSite=Strict cookie holding an HMAC derived from the token (changing the token signs everyone out).
- **Data:** `GET /api/admin/stats` returns recent runs, server settings and the recorded examples. The page filters, sorts, paginates and charts in the browser with the pure functions in `lib/admin/aggregate.ts`, so every number is unit tested.
- **Actions:** `POST /api/admin/actions` with `pause-live`, `resume-live`, `reset-limits` or `clear-log`. Each returns the fresh overview.
- **Sandbox snapshot:** `GET /api/admin/snapshot` says whether `FOUNDRY_SANDBOX_SNAPSHOT` is set and whether a build is running (the id is never sent). `POST` builds a new snapshot from inside the deployment (admin only, one at a time).
- **Two front doors, one view:** `components/admin/AdminView.tsx` draws the dashboard from an `AdminData` object (`useAdminData.ts`) and does not know where it came from. `AdminDashboard` feeds it from the server (`/admin`, signed in). `DemoDashboard` feeds it from `useDemoData.ts` and `lib/admin/sampleData.ts` (`/admin-demo`; public, made-up data, no network). Anything shown on `/admin-demo` must stay clearly labelled as sample data.
- **Privacy:** the log stores a short hash of the visitor address, never the address. It stores the visitor's idea as typed (after cleaning).

## Honesty constraints that shape the code

- `recordings-src/live/` and `lib/liveRecordings.json` are real output of live runs; the recorder is the only writer of the sources and `build-live-recordings.mjs` the only writer of the JSON.
- Every mode is labelled on the page. Simulated text is never shown as model output (`MODE_COPY` in `Stage.tsx`, `runSummary` in `lib/summary.ts`).
- `lib/reality.ts` and the project copy in `lib/profile.ts` must keep the caveats listed in `CLAUDE.md`.

## Tests

`npm test` runs everything in about three seconds. No test calls a real model or needs a key.

| File | Covers |
| --- | --- |
| `pipeline.test.ts` | Simulated, replayed and live runs (with a fake model client): rounds, verdicts, cost, spending cap, preflight fallback, refusal, time budget, cancellation. |
| `runRoute.test.ts` | The run API: validation, NDJSON streaming, limits, logging, error hiding, disconnect handling. |
| `Stage.test.tsx` | The critical page flows in jsdom: replay, typed idea, the finished app and save button, server error, dropped connection, rejected request. |
| `bundle.test.ts` | The one-file bundle (inlining, escaping, file name), the starter kit's write rules, and its real `npm test`. |
| `tools.test.ts`, `toolLoop.test.ts` | The workspace, each agent's tools and write rules, the tool loop, real test and browser runners (faked), refusals and the `files` event. |
| `admin.test.ts` | Sign-in, lockout, cookie, every admin route and action. |
| `sampleData.test.ts`, `DemoDashboard.test.tsx` | The sample data is repeatable, labelled and complete; the public demo makes no requests and its controls work on screen only. |
| `aggregate.test.ts`, `runLog.test.ts`, `runStore.test.ts` | Dashboard maths, the run log, and its memory/Redis stores. |
| `liveBrake.test.ts` | The live-run brake: Redis counts (fake database), refused runs not counted, daily rollover, memory fallback. |
| `rateLimit.test.ts`, `runApi.test.ts`, `ndjson.test.ts`, `liveRun.test.ts`, `run.test.ts`, `verdicts.test.ts`, `format.test.ts` | The smaller building blocks, including the integrity of the recordings. |

Pipeline tests pass `pace: 0` to skip the simulation's delays and `client` to inject a fake model.

## Recipes

**Change an agent's instructions or model:** edit `lib/pipeline/prompts.ts` (and `MODELS` in `config.ts`). Update `lib/agents.ts` only if its on-page description changes.

**Add an agent:** add its name to `AgentName` (`types.ts`), a row to `AGENT_LIST`, a spec in `prompts.ts`, a case in `simulate.ts`, a node and edges in `PipelineSvg.tsx`, and a step in `runPipeline` and `buildLiveReplayRun`. Replay uses the same shared reducer as live runs, so adding an agent means re-recording the recordings.

**Add a recorded example:** see "Adding a recorded example" in `CLAUDE.md`.

**Add an admin card or chart:** compute it in `lib/admin/aggregate.ts` with a test, then render it in `AdminDashboard.tsx`.

**Add an admin action:** add its name to `lib/admin/actions.ts`, handle it in `app/api/admin/actions/route.ts`, add a button in `ControlPanel.tsx`, and a case in `tests/admin.test.ts`.

**Move more server state to a database:** the run log (`runStore.ts`) and the live brake (`liveBrake.ts`) already have Redis stores. For the login limiter, follow the same pattern and construct it in `lib/server/state.ts`.
