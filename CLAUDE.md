# Foundry Portfolio

Portfolio site built around Foundry, an eight-agent app builder. Visitors type an idea for a small one-page app (or pick a recorded example), watch eight agents plan, build and test it, then use the finished app on the page or save it as one .html file. Live at https://alexmarushka.vercel.app.

## Workflow

Built with Claude Code and the Superpowers plugin (brainstorm, plan, test first, verify before claiming done). It is a dev workflow only: the site never runs it, and the site copy does not claim it.

## Commands

```bash
npm install
npm run dev          # http://localhost:3000
npm run typecheck
npm test             # vitest, no network or key needed
npm run build
npm run test:ui      # Playwright UI tests in installed Chrome (e2e/); starts the dev server, or BASE_URL=https://foundry-portfolio.vercel.app to test the live site. Recorded examples only, no model calls
npx.cmd vite-node scripts/record-live-runs.ts -- --requests 3 --confirm   # record real live runs into recordings-src/live/, costs money
npm run recordings:live   # rebuild lib/liveRecordings.json, the per-example lib/liveRecordings/*.json chunks and lib/exampleRequests.ts from recordings-src/live/
npx.cmd vite-node scripts/run-eval.ts -- --runs 8 --confirm   # real live runs, costs money; appends to lib/eval/results.json
```

On Windows PowerShell, run `npx.cmd` instead of `npx` (the `npx.ps1` script is blocked by the execution policy).

## Layout

Full map and recipes: `docs/ARCHITECTURE.md`. Short version:

- `lib/profile.ts`, `lib/reality.ts`: all page copy (name, hero title `headline`, `tagline` and `intro`, the "Project in short" case study `caseStudy` and its decisions `lessons`, About, "Scope and limits"). Keep it short: friends and family found the old copy too wordy (Nov 1, 2026). Edit these to change the site text. `tests/copy.test.ts` enforces the wording rules below on this copy.
- Logo: `components/Logo.tsx` (the mark, used in the nav and hero), `app/icon.svg` (tab icon, same drawing), `app/apple-icon.tsx` and `app/opengraph-image.tsx` (home-screen icon and the share-preview picture).
- `app/page.tsx`, `app/layout.tsx`, `app/globals.css`: the page and styles. `layout.tsx` loads Vercel Web Analytics (`/_vercel/insights/script.js`, page views only, no cookies) on Vercel builds; it needs Analytics enabled in the Vercel project.
- `components/Stage.tsx` plus `components/stage/`: the live agent view (hooks `usePlayback`, `useLiveRun`; `IdeaForm`, `OutputPanel`, `PlayerControls`). Recorded runs replay in the browser (a pure function of time, so it can be scrubbed); a typed idea (one text box, checked by `validateIdea` in `lib/spec.ts`, sent as `{ idea }`) streams from the server and becomes a scrubbable run. `components/PipelineSvg.tsx` draws the pipeline.
- `lib/run.ts`: run and step types, frames at a moment. `lib/liveReplay.ts`: lays a recorded live run out on a replay timeline. `lib/liveRun.ts`: reducer for streamed runs. `lib/agents.ts`, `lib/types.ts`: agent list and shared types (`FoundryEvent` is the stream protocol). Browser and server safe.
- `app/api/run/route.ts`: GET says whether live runs are on. POST streams a run (NDJSON), logs it, and aborts the agents if the visitor leaves. Live runs have per-browser (the `foundry_b` cookie), per-network and per-day brakes (`lib/server/liveBrake.ts`: shared in Upstash Redis when `KV_REST_API_URL` and `KV_REST_API_TOKEN` are set, per instance in memory otherwise); replays and simulations are free.
- `lib/starter.ts`: the starter kit every run begins from (index.html, style.css, app.js, ui.js, tests/app.test.js, README, package.json). The Logic engineer may write `app.js` and `tests/*.test.js`, the Interface engineer `index.html`, `style.css` and `ui.js`. `lib/bundle.ts` inlines the files into one self-contained .html file.
- `components/stage/AppPreview.tsx`, `public/preview/`: after an approved live run (or a replay of one with a `files` event), the bundled app shows right away in a sandboxed, offline iframe (opaque origin, `connect-src 'none'`; `runner.js` gives it an in-memory localStorage, so nothing is kept) and "Save the app" downloads the same file, which uses real localStorage.
- `lib/pipeline/`: `index.ts` (the run; stops early when the Story Writer answers `REFUSE:`), `prompts.ts` (the eight agents), `config.ts` (models, prices, caps), `agentRunner.ts`, `simulate.ts`, `replay.ts`, `verdicts.ts`. Live models need thinking switched off and effort low (see `modelParams` in `config.ts`), or thinking tokens eat the short output limit.
- `lib/server/`: in-memory server state (`state.ts`), rate limits, run log, admin auth, env parsing.
- Public sample-data dashboard: `app/admin-demo/` only (taken off the home page Nov 1, 2026), `lib/admin/sampleData.ts`. All numbers are made up; keep the banner and the `sample-` ids. Never present it as real traffic.
- Admin dashboard: `app/admin/`, `app/api/admin/*`, `components/admin/`, `lib/admin/`. Off unless `ADMIN_TOKEN` is set. Run log (`lib/server/runStore.ts`) is in memory per server instance, or in Upstash Redis when `KV_REST_API_URL` and `KV_REST_API_TOKEN` are set (falls back to memory if the database errors).
- Design: light page, dark stage; Schibsted Grotesk and JetBrains Mono (mono only for agent output). The full design system is in `DESIGN.md` ("The Control Room"); who the site is for and what must be kept is in `PRODUCT.md`. Read both before design work. Motion answers a user action, respects reduced motion, and animates only transform and opacity.
- `lib/pipeline/sandbox.ts`: unit tests (`npm test`, which is `node --test`) and the real browser in a Vercel Sandbox. It clears the old taskly files from the snapshot, writes the app, serves the bundled single file with a tiny Node server (`serve.cjs`) and runs a smoke test plus the Browser Tester's spec. `node scripts/build-sandbox-snapshot.mjs` (needs `.env.sandbox.local` from `npx.cmd vercel@latest env pull .env.sandbox.local --environment=development`, which is gitignored) builds the snapshot id for `FOUNDRY_SANDBOX_SNAPSHOT`; it only needs `node_modules` with `@playwright/test` and Chromium, so rebuild it after 30 days unused.
- `lib/pipeline/github.ts`: the GitHub App client from the old to-do version. Runs no longer open pull requests (since Nov 1, 2026); only the daily cron (`app/api/cron/close-stale-prs`, `vercel.json`) still uses it to close old drafts on taskly-sample.
- Two snapshot scripts, different jobs: `scripts/build-snapshot.mjs` copies the taskly-sample repo (current commit) into `lib/tasklySnapshot.json`; `scripts/build-sandbox-snapshot.mjs` builds the Vercel Sandbox snapshot id from that commit. Run the first, then the second, after taskly-sample changes. `POST /api/admin/snapshot` builds from the `lib/tasklySnapshot.json` bundled in the deployment, so commit and redeploy the first script's output before using it.
- `lib/pipeline/workspace.ts` serves the starter kit to the agents and keeps their writes in an overlay; `lib/pipeline/tools.ts` defines the tools (Researcher: read-only; Logic: `app.js`, `tests/`; Interface: `index.html`, `style.css`, `ui.js`; Browser Tester: read plus `run_browser_test`). No agent has a shell, so the Researcher is read-only by construction and nothing leaves memory. `lib/tasklySnapshot.json` now only names the repo the sandbox clones when no snapshot is set (its files are cleared before the app goes in).
- `lib/eval/` and `scripts/run-eval.ts`: measured runs. `collect.ts` counts only finished live runs (never simulations or replays), `summarize.ts` adds a 95% interval, `plan.ts` fixes the four requests and the spend cap. Results go to `lib/eval/results.json` (append-only, real runs only; never hand-edit). `components/EvalCard.tsx` is off the page since Nov 1, 2026: the 23 measured runs were of the old to-do version. Show it again only with runs of the app builder. The script needs `--confirm`, `ANTHROPIC_API_KEY` in `.env.local`, the sandbox login in `.env.sandbox.local` and `FOUNDRY_SANDBOX_SNAPSHOT` in either that file or `.env.eval.local`.
- `recordings-src/live/`: one JSON file per recorded real live run (the full event stream with timings), written by `scripts/record-live-runs.ts` (`lib/recorder/`). `recordings-src/archive-taskly/` (the to-do-app recordings) and `recordings-src/archive-text-only/`: kept for history, never edited, not shown anywhere.
- `lib/liveRecordings.json` (server), `lib/liveRecordings/<slug>.json` with `lib/liveRecordingChunks.ts` (browser: `loadLiveRecording` fetches only the example it plays, about 90 KB) and `lib/exampleRequests.ts`: generated from `recordings-src/live/` by `npm run recordings:live`. Do not edit by hand.
- `tests/`: Vitest. Run `npm test` before pushing. Pipeline tests inject a fake model client; no test needs a key.

## Modes

1. **Replay:** the request matches one of the three recorded examples. The full event stream of a real live run (real Claude output, the app's real unit tests, a real headless-Chromium test and its screenshots, and the finished app's files), played back faster than it ran. No model is called at replay time.
2. **Live:** typed idea and `ANTHROPIC_API_KEY` is set (and `FOUNDRY_LIVE` is not `off`). Each agent calls a real model. Costs money (cap $0.60 a run): keep the Anthropic console spend limit in place. Live models need thinking switched off and effort low (see `modelParams` in `lib/pipeline/config.ts`), or thinking tokens eat the short output limit.
3. **Simulated:** typed idea with no key, or over the live limits. Scripted text, labelled as such on the page. No app is built.

## Honesty rules

- The page must always say which mode ran. Never present simulated text as model output.
- Never hand-edit `recordings-src/live/` events or the archive folders. Replay is only honest if it is the real output. Each example recording is kept as it came out.
- In a live run the agents work on an in-memory copy of the starter kit; its unit tests and one Playwright browser test (written by the Browser Tester, run in real headless Chromium against the bundled file) run in a Vercel Sandbox started from `FOUNDRY_SANDBOX_SNAPSHOT`, network off. The simulation runs no code and builds no app. No human reviews the apps; never say "reviewed", "success rate" or "reliable". Three examples are a demo, not a success rate.
- The app preview runs in a sealed frame and keeps nothing; the saved file uses the browser's own storage. Say so; don't promise the apps are bug-free.
- Runs open no pull request any more. Don't describe the output as a pull request.
- `/admin-demo` shows made-up data. It must always say so, and never be described as real usage, visitors or spend.
- Do not commit `.env*` files (only `.env.example`) or `.vercel/`.

## Deploying

Pushes to `main` redeploy automatically through the Vercel GitHub integration (project `foundry-portfolio`). Manual deploy: `npx.cmd vercel@latest deploy --prod --yes`.

## Adding a recorded example

1. Add the request to the plan in `lib/eval/plan.ts` (or pass the count to `--requests`); the script records the first N planned requests.
2. Put `ANTHROPIC_API_KEY` in `.env.local`, the sandbox login in `.env.sandbox.local` and `FOUNDRY_SANDBOX_SNAPSHOT` in `.env.eval.local` (all gitignored; never print them).
3. Run `npx.cmd vite-node scripts/record-live-runs.ts -- --requests N --confirm`. To re-record an existing example, first move its file out of `recordings-src/live/` and run `npm run recordings:live`: the script skips existing files, and a request that matches a shipped recording is replayed instead of run live (the recorder then refuses it). It writes `recordings-src/live/<slug>.json`. Keep each run as it came out; never edit or cherry-pick events.
4. Run `npm run recordings:live` to rebuild `lib/liveRecordings.json`, the per-example chunks and `lib/exampleRequests.ts`.
5. Run `npm test` (the recorder, replay and example-request tests check shape, size, secrets and that the shipped request list matches the recordings), `npm run typecheck`, `npm run build`, then push.
6. Re-check any numbers in `lib/reality.ts` and `lib/profile.ts` against the new files.
