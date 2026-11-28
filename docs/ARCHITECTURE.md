# Architecture

How the code is organised, how a run flows through it, and where to change things. For setup and day-to-day commands, see the [README](../README.md).

## Layers

```
app/                     Next.js routes only: pages and HTTP handlers. Thin; they call into lib/.
  page.tsx               The public page.
  layout.tsx, globals.css  The page shell and styles. layout.tsx loads Vercel Web Analytics (/_vercel/insights/script.js, page views only, no cookies) on Vercel builds; it needs Analytics enabled in the Vercel project.
                           globals.css also loads Tailwind v4 (theme and utilities only, no reset layer, scan limited to components/ui) and the shadcn tokens, named --ui-*. Rules for adding shadcn components are in the comment at the top of globals.css.
  icon.svg, apple-icon.tsx, opengraph-image.tsx   Tab icon (same drawing as components/Logo.tsx), home-screen icon, and the share-preview picture.
  admin/                 The admin dashboard page (server-gated) and its CSS.
  api/run/               GET: is live on? POST: stream a run as NDJSON (see "A run, end to end" and "Reference notes").
  api/share/             POST: make a hosted app link (see step 4 of "A run, end to end").
  api/cron/close-stale-prs/   Daily cron (vercel.json) that closes old drafts on taskly-sample; the only user of lib/pipeline/github.ts.
  a/[id]/                Hosted app links: wrapper page, sealed app, manifest. pwa-icon/ makes the install icons.
  admin-demo/            Public sample-data copy of the dashboard. No token, no server data.
  api/admin/{login,logout,stats,actions}/   Admin API. Every route except login needs the session cookie.
  api/admin/{share,snapshot}/   Remove a pasted app link; build the sandbox snapshot.

components/              React UI.
  Stage.tsx              The live agent view. Owns the state and wires the pieces below together.
  stage/                 Its parts: IdeaForm, OutputPanel, PlayerControls, EvidenceCard, AppPreview, AgentList (the
                         window's sidebar, read from the same frames as the drawing), and hooks (usePlayback,
                         useLiveRun, useMediaQuery, useLiveAvailability, useOnceInView).
  home/Intro.tsx         The sections under the hero: the facts strip, the one-sentence statement and the three steps.
                         Their copy is in `lib/profile.ts` (facts, statement, stepsTitle, steps).
  PipelineSvg.tsx        Draws the eight-agent pipeline.
  HowItWorks.tsx         The still "How it works" diagram in the case study (see "Reference notes").
  AgentIcon.tsx          The eight 24px agent glyphs used in the pipeline drawing and the diagram.
  Logo.tsx               The mark, used in the nav and hero.
  EvalCard.tsx           Measured-runs card. Off the page since Nov 1, 2026 (see "Reference notes").
  admin/                 Dashboard: AdminDashboard, KpiCards, FilterBar, RunsTable, ControlPanel, charts, useAdminData.

lib/                     Everything that isn't React or HTTP.
  profile.ts, reality.ts All the page copy (see "Reference notes").
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
  share.ts, previewShim.ts, securityHeaders.ts   Hosted-link rules and limits (128 KB cap), the storage stand-in and loader page, and every response's headers.
  eval/                  Measured runs: collect.ts, summarize.ts, plan.ts, results.json (see "Reference notes").
  recorder/              The code behind scripts/record-live-runs.ts.
  liveRecordings.json    GENERATED from recordings-src/live/ (npm run recordings:live). Never hand-edit.
  liveRecordings/<slug>.json, liveRecordingChunks.ts   GENERATED with it: one chunk per example for the browser (loadLiveRecording fetches only the example it plays, about 90 KB).
  exampleRequests.ts     GENERATED with it: the three example requests.

public/                  Static files.
  preview/               frame.html and full.html: the sealed preview frame and the full-screen page (see step 4 of "A run, end to end").
  app-bridge.js, app-install.js   Hosted-link wrapper scripts: the per-link storage bridge and the install button or note.

tests/                   Vitest. One file per area; see "Tests" below.
e2e/                     Playwright browser tests (npm run test:ui, test:ui:browsers).
recordings-src/live/     The three real recorded live runs (full event streams). archive-taskly/ (the old to-do-app runs) and archive-text-only/ are kept for history, never edited, not shown anywhere.
scripts/                 record-live-runs.ts, build-live-recordings.mjs, build-snapshot.mjs, build-sandbox-snapshot.mjs, run-eval.ts.
DESIGN.md, PRODUCT.md    The design system ("The Control Room") and who the site is for. Read both before design work.
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
   A live run that passed both checks also sends a `files` event (the files the agents wrote) just before `finish`. The finished run then shows `components/stage/AppPreview.tsx`: the bundled app opens right away in `public/preview/frame.html`, a sandboxed iframe (opaque origin), where the inline script in `public/preview/frame.html` adds an in-memory localStorage and writes the app into the frame. The frame's own CSP (`previewHeaders` in `lib/securityHeaders.ts`) allows no network. "Save the web app" saves the same bundle, which uses the browser's real storage: through the browser's "Save as" window (`showSaveFilePicker`, Chrome and Edge) or, failing that, a download. Because some company computers block downloads, there are two more ways: "Open full screen" opens `public/preview/full.html` in a new tab (policy `fullscreenHeaders`; its `full.js` asks the opener for the html with postMessage and puts it in the same sealed iframe, giving up after 5 seconds if nobody answers; once the html is there, a message with Save the web app, Copy the code and Try again covers the app if the frame has not opened it 6 seconds after the frame loads, and goes away again if the app opens late), and "Copy the code" puts the file on the clipboard. "Get a link" (pressed for a recorded example, made by itself when a real run finishes) keeps the file on the server for 30 days after its last open and 60 days at most (`lib/share.ts`; `lib/server/shareStore.ts` reads and renews the idle clock with one `GETEX` and keeps the made-date under `foundry:appmade:<id>` for the cap): `POST /api/share` checks it (`lib/server/shareCheck.ts`), counts it against the limits (`lib/server/shareBrake.ts`: 5 an hour per address, 40 a day for the site) and stores it in Upstash Redis (`lib/server/shareStore.ts`; only apps that came from a Foundry run can get a link: the run route signs the finished app's `files` event with an HMAC (`lib/server/shareSigner.ts`, key kept in Redis and created on first use), the page sends the files and that signature, the endpoint checks it (or matches a shipped recording for a replay) and builds the page itself with `bundleApp`, so a hand-written page cannot get a link; `FOUNDRY_SHARE=off` switches links off, including opening existing ones; the button is hidden without the database, and there is no memory fallback on purpose). A link opens `app/a/[id]/route.ts`, a wrapper page that holds only the site's own markup and one sandboxed frame (`sharedWrapperHeaders`, `lib/securityHeaders.ts`; its `frame-src 'self'` is the lock: a framed app cannot send the visitor to another website, which a sandbox alone cannot stop). The frame loads `app/a/[id]/app/route.ts`, which serves the app with `sharedAppHeaders`: a CSP `sandbox` without allow-same-origin, so the page has no cookies, storage or network, plus noindex and no-store. Loaded as anything but an iframe (`Sec-Fetch-Dest`), the app page redirects to the wrapper so the lock cannot be skipped. The app page is a small loader (`hostedAppPage` in `lib/previewShim.ts`) with the app inside as an escaped string: it asks the wrapper for the app's saved data, waits, then writes the app into itself with a storage object that starts from that data and tells the wrapper about every change (8 seconds without an answer starts the app with memory-only storage). The wrapper's own script `public/app-bridge.js` (the only script its CSP allows, `script-src 'self'`) answers only the sealed frame and keeps the data in the real localStorage under `foundry:app:<id>:`, at most 256 KB a link (`HOSTED_STORAGE_MAX`). The wrapper also carries `<link rel="manifest">` (`app/a/[id]/manifest.webmanifest/route.ts`, named after the app's title, `display: standalone`, never renews the idle clock), icons from `app/pwa-icon/[size]/route.tsx`, and the iOS home-screen tags, so the link can be added to a home screen or installed. A second site script, `public/app-install.js`, offers the install in as few taps as the browser allows: in Chrome and Edge it keeps the `beforeinstallprompt` event and shows one "Install app" button that opens the browser's own question; on iPhone, iPad and Safari 17+ on a Mac, where no website can start an install, it shows a short note saying what to tap (⋯, Share, Add to Home Screen; or File, Add to Dock). It shows nothing when the page already runs as an installed app, a dismissed note stays quiet for up to 30 days (the browser may clear it sooner; `foundry:install-dismissed:<id>` in the wrapper's localStorage), and the app itself never sees it. There is no service worker on purpose: nothing is cached, so removing a link or `FOUNDRY_SHARE=off` takes effect at once, and an installed app needs a connection. The content check runs again on every open. The admin page's "App links" box (`/api/admin/share`) removes one pasted link.
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

## Reference notes (moved from CLAUDE.md)

Facts about specific files that the layer map and the run walkthrough above do not hold.

- **Page copy:** `lib/profile.ts` and `lib/reality.ts` hold all the page copy (name, hero title `headline`, `tagline` and `intro`, the "Project in short" case study `caseStudy` and its decisions `lessons`, About, "Scope and limits"). Keep it short: friends and family found the old copy too wordy (Nov 1, 2026). Edit these to change the site text. `tests/copy.test.ts` enforces the wording rules in `CLAUDE.md` on this copy.
- **Stage:** recorded runs replay in the browser as a pure function of time, so they can be scrubbed. A typed idea (one text box, checked by `validateIdea` in `lib/spec.ts`, sent as `{ idea }`) streams from the server and becomes a scrubbable run. Replays and simulations are free; only live runs count against the brakes.
- **How it works diagram:** `components/HowItWorks.tsx` shows the idea, the eight agents in four groups, the sent-back loop and the app. It is two drawings, wide above 960px and narrow below, with the text in `profile.diagram` (covered by `tests/copy.test.ts`). It was designed in the Figma file "Foundry: agent icons" and never animates.
- **Starter kit:** `lib/starter.ts` holds index.html, style.css, app.js, ui.js, tests/app.test.js, README and package.json. The Logic engineer may write `app.js` and `tests/*.test.js`; the Interface engineer `index.html`, `style.css` and `ui.js`. `lib/bundle.ts` inlines the files into one self-contained .html file.
- **Agent tools:** `lib/pipeline/workspace.ts` serves the starter kit to the agents and keeps their writes in an overlay. `lib/pipeline/tools.ts` defines the tools: Researcher read-only; Logic `app.js` and `tests/`; Interface `index.html`, `style.css` and `ui.js`; Browser Tester read plus `run_browser_test`. No agent has a shell, so the Researcher is read-only by construction and nothing leaves memory. `lib/tasklySnapshot.json` now only names the repo the sandbox clones when no snapshot is set (its files are cleared before the app goes in).
- **Pipeline files:** `index.ts` is the run (it stops early when the Story Writer answers `REFUSE:`), `prompts.ts` the eight agents, `config.ts` models, prices, caps and `modelParams`, then `agentRunner.ts`, `simulate.ts`, `replay.ts` and `verdicts.ts`.
- **Hosted-link details:** the preview frame has an opaque origin and `connect-src 'none'`; `full.html` has its own CSP, `fullscreenHeaders` and COOP same-origin. A replay of a shipped recording is matched against the recordings instead of a signature; unsigned or altered files get a 403. `lib/server/shareCheck.ts` re-runs on every open and looks for password or card fields, sign-in lures, outside forms, redirects and embedded pages. Never serve agent-written html from any other route or without those headers.
- **Sandbox:** `lib/pipeline/sandbox.ts` runs the unit tests (`npm test`, which is `node --test`) and the real browser in a Vercel Sandbox. It clears the old taskly files from the snapshot, writes the app, serves the bundled single file with a tiny Node server (`serve.cjs`) and runs a smoke test plus the Browser Tester's spec. `node scripts/build-sandbox-snapshot.mjs` builds the snapshot id for `FOUNDRY_SANDBOX_SNAPSHOT`. It needs `.env.sandbox.local` (gitignored) from `npx.cmd vercel@latest env pull .env.sandbox.local --environment=development`, and only needs `node_modules` with `@playwright/test` and Chromium. Rebuild it after 30 days unused.
- **Two snapshot scripts, different jobs:** `scripts/build-snapshot.mjs` copies the taskly-sample repo (current commit) into `lib/tasklySnapshot.json`; `scripts/build-sandbox-snapshot.mjs` builds the Vercel Sandbox snapshot id from that commit. Run the first, then the second, after taskly-sample changes. `POST /api/admin/snapshot` builds from the `lib/tasklySnapshot.json` bundled in the deployment, so commit and redeploy the first script's output before using it.
- **GitHub App client:** `lib/pipeline/github.ts` is left from the old to-do version. Runs no longer open pull requests (since Nov 1, 2026); only the daily cron (`app/api/cron/close-stale-prs`, `vercel.json`) still uses it to close old drafts on taskly-sample.
- **Measured runs:** `lib/eval/` and `scripts/run-eval.ts`. `collect.ts` counts only finished live runs (never simulations or replays), `summarize.ts` adds a 95% interval, `plan.ts` fixes the four requests and the spend cap. Results go to `lib/eval/results.json` (append-only, real runs only; never hand-edit). `components/EvalCard.tsx` is off the page since Nov 1, 2026: the 23 measured runs were of the old to-do version. Show it again only with runs of the app builder. The script needs `--confirm`, `ANTHROPIC_API_KEY` in `.env.local`, the sandbox login in `.env.sandbox.local` and `FOUNDRY_SANDBOX_SNAPSHOT` in either that file or `.env.eval.local`.
- **Recordings:** `recordings-src/live/` holds one JSON file per recorded real live run (the full event stream with timings), written by `scripts/record-live-runs.ts` (`lib/recorder/`). `lib/liveRecordings.json`, `lib/liveRecordings/<slug>.json`, `lib/liveRecordingChunks.ts` and `lib/exampleRequests.ts` are generated from it by `npm run recordings:live`. Do not edit any of them by hand.
- **Sample dashboard:** `app/admin-demo/` only (taken off the home page Nov 1, 2026), with `lib/admin/sampleData.ts`. All numbers are made up; keep the banner and the `sample-` ids. Never present it as real traffic.
- **Admin dashboard:** off unless `ADMIN_TOKEN` is set. The run log (`lib/server/runStore.ts`) is in memory per server instance, or in Upstash Redis when `KV_REST_API_URL` and `KV_REST_API_TOKEN` are set (falls back to memory if the database errors).
- **Design:** light page, dark stage; Schibsted Grotesk and JetBrains Mono (mono only for agent output). The full design system is in `DESIGN.md` ("The Control Room"); who the site is for and what must be kept is in `PRODUCT.md`. Read both before design work. Motion answers a user action, respects reduced motion, and animates only transform and opacity.

## Tests

`npm test` runs everything in about three seconds. Run it before pushing. No test calls a real model or needs a key; pipeline tests inject a fake model client.

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

**Add an agent:** add its name to `AgentName` (`types.ts`), a row to `AGENT_LIST`, a spec in `prompts.ts`, a case in `simulate.ts`, a node and edges in `PipelineSvg.tsx`, a step in `runPipeline` and `buildLiveReplayRun`, and its place in `profile.steps` (the three steps under the demo; a test checks that every agent appears exactly once). The demo window's sidebar reads `AGENT_LIST`, so it picks the new agent up by itself. Replay uses the same shared reducer as live runs, so adding an agent means re-recording the recordings.

**Add a recorded example:** use the `add-recorded-example` skill (`.claude/skills/add-recorded-example/SKILL.md`).

**Add an admin card or chart:** compute it in `lib/admin/aggregate.ts` with a test, then render it in `AdminDashboard.tsx`.

**Add an admin action:** add its name to `lib/admin/actions.ts`, handle it in `app/api/admin/actions/route.ts`, add a button in `ControlPanel.tsx`, and a case in `tests/admin.test.ts`.

**Move more server state to a database:** the run log (`runStore.ts`) and the live brake (`liveBrake.ts`) already have Redis stores. For the login limiter, follow the same pattern and construct it in `lib/server/state.ts`.
