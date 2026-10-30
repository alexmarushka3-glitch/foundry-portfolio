# Foundry Portfolio

Portfolio site with a live demo of Foundry, an eight-agent software factory. Visitors give a rough idea for a small task-tracker app and watch agents turn it into a pull request draft checked by other agents. Live at https://alexmarushka.vercel.app.

## Workflow

Built with Claude Code and the Superpowers plugin (brainstorm, plan, test first, verify before claiming done). It is a dev workflow only: the site never runs it, and the site copy does not claim it.

## Commands

```bash
npm install
npm run dev          # http://localhost:3000
npm run typecheck
npm test             # vitest, no network or key needed
npm run build
npx.cmd vite-node scripts/record-live-runs.ts -- --requests 4 --confirm   # record real live runs into recordings-src/live/, costs money, opens no pull request
npm run recordings:live   # rebuild lib/liveRecordings.json, the per-example lib/liveRecordings/*.json chunks and lib/exampleRequests.ts from recordings-src/live/
npx.cmd vite-node scripts/run-eval.ts -- --runs 8 --confirm   # real live runs, costs money; appends to lib/eval/results.json
```

On Windows PowerShell, run `npx.cmd` instead of `npx` (the `npx.ps1` script is blocked by the execution policy).

## Layout

Full map and recipes: `docs/ARCHITECTURE.md`. Short version:

- `lib/profile.ts`, `lib/reality.ts`: all page copy (name, hero title `headline` and description `intro`, About, projects, "what's real"). Edit these to change the site text. `tests/copy.test.ts` enforces the wording rules below on this copy.
- Logo: `components/Logo.tsx` (the mark, used in the nav and hero), `app/icon.svg` (tab icon, same drawing), `app/apple-icon.tsx` and `app/opengraph-image.tsx` (home-screen icon and the share-preview picture).
- `app/page.tsx`, `app/layout.tsx`, `app/globals.css`: the page and styles.
- `components/Stage.tsx` plus `components/stage/`: the live agent view (hooks `usePlayback`, `useLiveRun`; `IdeaForm`, `OutputPanel`, `PlayerControls`). Recorded runs replay in the browser (a pure function of time, so it can be scrubbed); requests built from the form fields (`lib/spec.ts`) stream from the server and become a scrubbable run. `components/PipelineSvg.tsx` draws the pipeline.
- `lib/run.ts`: run and step types, frames at a moment. `lib/liveReplay.ts`: lays a recorded live run out on a replay timeline. `lib/liveRun.ts`: reducer for streamed runs. `lib/agents.ts`, `lib/types.ts`: agent list and shared types (`FoundryEvent` is the stream protocol). Browser and server safe.
- `app/api/run/route.ts`: GET says whether live runs are on. POST streams a run (NDJSON), logs it, and aborts the agents if the visitor leaves. Live runs have per-visitor and per-day brakes (`lib/server/liveBrake.ts`: shared in Upstash Redis when `KV_REST_API_URL` and `KV_REST_API_TOKEN` are set, per instance in memory otherwise); replays and simulations are free.
- `components/stage/AppPreview.tsx`, `public/preview/`, `lib/zip.ts`: after an approved live run (or a replay of one recorded with a `files` event), visitors try the finished app in a sandboxed, offline iframe (its real server code on stand-ins for Express and SQLite via sql.js in `public/vendor/`) and download it as a .zip. Say it runs on stand-ins; never call it the exact Node server.
- `lib/pipeline/`: `index.ts` (the run), `prompts.ts` (the eight agents), `config.ts` (models, prices, caps), `agentRunner.ts`, `simulate.ts`, `replay.ts`, `verdicts.ts`. Live models need thinking switched off and effort low (see `modelParams` in `config.ts`), or thinking tokens eat the short output limit.
- `lib/server/`: in-memory server state (`state.ts`), rate limits, run log, admin auth, env parsing.
- Public sample-data dashboard: `app/admin-demo/` (full page) and `components/admin/DashboardSection.tsx` (compact, on the home page before "Scope and limits"), `lib/admin/sampleData.ts`. All numbers are made up; keep the banner, the `sample-` ids and the "made up" line in `lib/reality.ts`. Never present it as real traffic.
- Admin dashboard: `app/admin/`, `app/api/admin/*`, `components/admin/`, `lib/admin/`. Off unless `ADMIN_TOKEN` is set. Run log (`lib/server/runStore.ts`) is in memory per server instance, or in Upstash Redis when `KV_REST_API_URL` and `KV_REST_API_TOKEN` are set (falls back to memory if the database errors).
- Design: light page, dark stage; Schibsted Grotesk and JetBrains Mono (mono only for agent output). The full design system is in `DESIGN.md` ("The Control Room"); who the site is for and what must be kept is in `PRODUCT.md`. Read both before design work. Motion answers a user action, respects reduced motion, and animates only transform and opacity.
- `lib/pipeline/sandbox.ts`: unit tests and the real browser in a Vercel Sandbox. `node scripts/build-sandbox-snapshot.mjs` (needs `.env.sandbox.local` from `npx.cmd vercel@latest env pull .env.sandbox.local --environment=development`, which is gitignored) builds the sandbox snapshot id for `FOUNDRY_SANDBOX_SNAPSHOT`; rebuild it when taskly-sample changes or after 30 days unused.
- `lib/pipeline/github.ts`: the GitHub App client that opens the draft PR and closes stale ones; `app/api/cron/close-stale-prs` plus `vercel.json` run daily. Needs `GITHUB_APP_ID`, `GITHUB_APP_INSTALLATION_ID`, `GITHUB_APP_PRIVATE_KEY` and `CRON_SECRET` in Vercel; without them no PR is opened.
- `lib/tasklySnapshot.json`: an in-memory copy of the `taskly-sample` repo (rebuild with `node scripts/build-snapshot.mjs` after committing there). `lib/pipeline/workspace.ts` serves it to the agents and keeps their writes in an overlay; `lib/pipeline/tools.ts` defines the tools (Researcher: read-only; Backend: `src/` and `tests/`; Frontend: `public/`). No agent has a shell, so the Researcher is read-only by construction and nothing leaves memory.
- `lib/eval/` and `scripts/run-eval.ts`: measured runs. `collect.ts` counts only finished live runs (never simulations or replays), `summarize.ts` adds a 95% interval, `plan.ts` fixes the four requests and the spend cap. Results go to `lib/eval/results.json` (append-only, real runs only; never hand-edit). `components/EvalCard.tsx` shows them under Scope and limits and renders nothing while the file is empty. The script needs `--confirm`, `ANTHROPIC_API_KEY` in `.env.local`, the sandbox login in `.env.sandbox.local` and `FOUNDRY_SANDBOX_SNAPSHOT` in either that file or `.env.eval.local`.
- `recordings-src/live/`: one JSON file per recorded real live run (the full event stream with timings), written by `scripts/record-live-runs.ts` (`lib/recorder/`). `recordings-src/archive-text-only/`: the old text-only recordings, kept for history, never edited, not shown anywhere.
- `lib/liveRecordings.json` (server), `lib/liveRecordings/<slug>.json` with `lib/liveRecordingChunks.ts` (browser: `loadLiveRecording` fetches only the example it plays, about 90 KB) and `lib/exampleRequests.ts`: generated from `recordings-src/live/` by `npm run recordings:live`. Do not edit by hand.
- `tests/`: Vitest. Run `npm test` before pushing. Pipeline tests inject a fake model client; no test needs a key.

## Modes

1. **Replay:** the request matches one of the three recorded examples. The full event stream of a real live run (real Claude output, the sample app's real unit tests, a real headless-Chromium test and its screenshots), played back faster than it ran. No code runs and no model is called at replay time; the recordings opened no pull request.
2. **Live:** typed idea and `ANTHROPIC_API_KEY` is set (and `FOUNDRY_LIVE` is not `off`). Each agent calls a real model. Costs money: keep the Anthropic console spend limit in place. Live models need thinking switched off and effort low (see `modelParams` in `lib/pipeline.ts`), or thinking tokens eat the short output limit.
3. **Simulated:** typed idea with no key, or over the live limits. Scripted text, labelled as such on the page.

## Honesty rules

- The page must always say which mode ran. Never present simulated text as model output.
- Never hand-edit `recordings-src/live/` events or `recordings-src/archive-text-only/`. Replay is only honest if it is the real output. Each example recording is kept as it came out (all three were re-recorded once, on Oct 30, 2026, to add the `files` event).
- The agents work on an in-memory copy of a small sample app and in a live run its own tests and one Playwright browser test (written by the E2E Verifier, run in real headless Chromium) are run on it, in a Vercel Sandbox started from the snapshot in `FOUNDRY_SANDBOX_SNAPSHOT` (the simulation runs no code and its E2E Verifier is an agent walking through flows; the recordings are of live runs, so they include the real tests and browser test). A live run that passes both checks opens a real *draft* pull request on taskly-sample (GitHub App, repo-scoped; the recordings were recorded without opening a pull request (no `pr` event in any recording), and simulations open none); no human reviews it. Keep those caveats wherever the project is described.
- All three recorded runs were approved on the first round, so no recording shows the send-back to a second round. Live runs sometimes are sent back (a live test run on Oct 24, 2026 was sent back once by the Validator and passed on round two), but those runs were not recorded. Three replays are a demo, not a success rate; do not claim one. The Measured runs card may show the approved count and its 95% interval (for example 22 of 23, 79% to 99%) because it names the small sample and says it is not a success rate; never say "success rate" or "reliable" about it elsewhere. Say the pull request is "a draft checked by other agents and real tests", never "reviewed".
- `/admin-demo` shows made-up data. It must always say so, and never be described as real usage, visitors or spend.
- Do not commit `.env*` files (only `.env.example`) or `.vercel/`.

## Deploying

Pushes to `main` redeploy automatically through the Vercel GitHub integration (project `foundry-portfolio`). Manual deploy: `npx.cmd vercel@latest deploy --prod --yes`.

## Adding a recorded example

1. Add the request to the plan in `lib/eval/plan.ts` (or pass the count to `--requests`); the script records the first N planned requests.
2. Put `ANTHROPIC_API_KEY` in `.env.local`, the sandbox login in `.env.sandbox.local` and `FOUNDRY_SANDBOX_SNAPSHOT` in `.env.eval.local` (all gitignored; never print them).
3. Run `npx.cmd vite-node scripts/record-live-runs.ts -- --requests N --confirm`. To re-record an existing example, first delete its file in `recordings-src/live/` and run `npm run recordings:live`: the script skips existing files, and a request that matches a shipped recording is replayed instead of run live (the recorder then refuses it). It costs about $0.18 to $0.31 a run, reads no GitHub env (so no pull request opens) and writes `recordings-src/live/<slug>.json`. Keep each run as it came out; never edit or cherry-pick events.
4. Run `npm run recordings:live` to rebuild `lib/liveRecordings.json`, the per-example chunks and `lib/exampleRequests.ts`.
5. Run `npm test` (the recorder, replay and example-request tests check shape, size, secrets and that the shipped request list matches the recordings), `npm run typecheck`, `npm run build`, then push.
6. Re-check the numbers in `lib/reality.ts` (seconds, cost, rounds) against the new files.
