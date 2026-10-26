# Foundry Portfolio

Portfolio site with a live demo of Foundry, an eight-agent software factory. Visitors give a rough idea for a small task-tracker app and watch agents turn it into a pull request draft checked by other agents. Live at https://foundry-portfolio.vercel.app.

## Commands

```bash
npm install
npm run dev          # http://localhost:3000
npm run typecheck
npm test             # vitest, no network or key needed
npm run build
node scripts/build-recordings.mjs   # rebuild lib/recordings.json from recordings-src/
```

On Windows PowerShell, run `npx.cmd` instead of `npx` (the `npx.ps1` script is blocked by the execution policy).

## Layout

Full map and recipes: `docs/ARCHITECTURE.md`. Short version:

- `lib/profile.ts`, `lib/reality.ts`: all page copy (name, hero title `headline` and description `intro`, About, projects, "what's real"). Edit these to change the site text. `tests/copy.test.ts` enforces the wording rules below on this copy.
- Logo: `components/Logo.tsx` (the mark, used in the nav and hero), `app/icon.svg` (tab icon, same drawing), `app/apple-icon.tsx` and `app/opengraph-image.tsx` (home-screen icon and the share-preview picture).
- `app/page.tsx`, `app/layout.tsx`, `app/globals.css`: the page and styles.
- `components/Stage.tsx` plus `components/stage/`: the live agent view (hooks `usePlayback`, `useLiveRun`; `IdeaForm`, `OutputPanel`, `PlayerControls`). Recorded runs replay in the browser (a pure function of time, so it can be scrubbed); requests built from the form fields (`lib/spec.ts`) stream from the server and become a scrubbable run. `components/PipelineSvg.tsx` draws the pipeline.
- `lib/run.ts`: recordings, replay timeline, frames at a moment. `lib/liveRun.ts`: reducer for streamed runs. `lib/agents.ts`, `lib/types.ts`: agent list and shared types (`FoundryEvent` is the stream protocol). Browser and server safe.
- `app/api/run/route.ts`: GET says whether live runs are on. POST streams a run (NDJSON), logs it, and aborts the agents if the visitor leaves. Live runs have per-visitor and per-day brakes; replays and simulations are free.
- `lib/pipeline/`: `index.ts` (the run), `prompts.ts` (the eight agents), `config.ts` (models, prices, caps), `agentRunner.ts`, `simulate.ts`, `replay.ts`, `verdicts.ts`. Live models need thinking switched off and effort low (see `modelParams` in `config.ts`), or thinking tokens eat the short output limit.
- `lib/server/`: in-memory server state (`state.ts`), rate limits, run log, admin auth, env parsing.
- Public sample-data dashboard: `app/admin-demo/` (full page) and `components/admin/DashboardSection.tsx` (compact, on the home page before "Scope and limits"), `lib/admin/sampleData.ts`. All numbers are made up; keep the banner, the `sample-` ids and the "made up" line in `lib/reality.ts`. Never present it as real traffic.
- Admin dashboard: `app/admin/`, `app/api/admin/*`, `components/admin/`, `lib/admin/`. Off unless `ADMIN_TOKEN` is set. Run log is in memory per server instance.
- Design: light page, dark stage; Schibsted Grotesk and JetBrains Mono (mono only for agent output). The full design system is in `DESIGN.md` ("The Control Room"); who the site is for and what must be kept is in `PRODUCT.md`. Read both before design work. Motion answers a user action, respects reduced motion, and animates only transform and opacity.
- `lib/pipeline/sandbox.ts`: unit tests and the real browser in a Vercel Sandbox. `node scripts/build-sandbox-snapshot.mjs` (needs `.env.sandbox.local` from `npx.cmd vercel@latest env pull .env.sandbox.local --environment=development`, which is gitignored) builds the sandbox snapshot id for `FOUNDRY_SANDBOX_SNAPSHOT`; rebuild it when taskly-sample changes or after 30 days unused.
- `lib/pipeline/github.ts`: the GitHub App client that opens the draft PR and closes stale ones; `app/api/cron/close-stale-prs` plus `vercel.json` run daily. Needs `GITHUB_APP_ID`, `GITHUB_APP_INSTALLATION_ID`, `GITHUB_APP_PRIVATE_KEY` and `CRON_SECRET` in Vercel; without them no PR is opened.
- `lib/tasklySnapshot.json`: an in-memory copy of the `taskly-sample` repo (rebuild with `node scripts/build-snapshot.mjs` after committing there). `lib/pipeline/workspace.ts` serves it to the agents and keeps their writes in an overlay; `lib/pipeline/tools.ts` defines the tools (Researcher: read-only; Backend: `src/` and `tests/`; Frontend: `public/`). No agent has a shell, so the Researcher is read-only by construction and nothing leaves memory.
- `recordings-src/`: raw outputs of real runs (`<slug>/N-agent.txt`) plus `meta.json` (models, timings, request text).
- `lib/recordings.json`: generated from `recordings-src/`. Do not edit by hand.
- `tests/`: Vitest. Run `npm test` before pushing. Pipeline tests inject a fake model client; no test needs a key.

## Modes

1. **Replay:** the request matches a recorded example. Genuine Claude output from a real run, played back faster than it ran.
2. **Live:** typed idea and `ANTHROPIC_API_KEY` is set (and `FOUNDRY_LIVE` is not `off`). Each agent calls a real model. Costs money: keep the Anthropic console spend limit in place. Live models need thinking switched off and effort low (see `modelParams` in `lib/pipeline.ts`), or thinking tokens eat the short output limit.
3. **Simulated:** typed idea with no key, or over the live limits. Scripted text, labelled as such on the page.

## Honesty rules

- The page must always say which mode ran. Never present simulated text as model output.
- Never hand-edit `recordings-src/` text. Replay is only honest if it is the real output.
- The agents work on an in-memory copy of a small sample app and in a live run its own tests and one Playwright browser test (written by the E2E Verifier, run in real headless Chromium) are run on it, in a Vercel Sandbox started from the snapshot in `FOUNDRY_SANDBOX_SNAPSHOT` (recordings and simulations run no code; they came from the older text-only version, where the E2E Verifier was an agent walking through flows). A live run that passes both checks opens a real *draft* pull request on taskly-sample (GitHub App, repo-scoped; recordings and simulations open none); no human reviews it. Keep those caveats wherever the project is described.
- All three recorded runs passed on the first round, so no recording has exercised the send-back to a second round. A live test run (Oct 24, 2026) was sent back once by the Validator and passed on round two, so the loop works, but that run was not recorded. Do not claim a success rate.
- `/admin-demo` shows made-up data. It must always say so, and never be described as real usage, visitors or spend.
- Do not commit `.env*` files (only `.env.example`) or `.vercel/`.

## Deploying

Pushes to `main` redeploy automatically through the Vercel GitHub integration (project `foundry-portfolio`). Manual deploy: `npx.cmd vercel@latest deploy --prod --yes`.

## Adding a recorded example

1. Run the eight stages as separate agents on a new request. Pass each stage the previous stage's real output.
2. Save each output as `recordings-src/<slug>/1-researcher.txt` through `8-release.txt`.
3. Add the request and per-stage timings (ms) to `recordings-src/meta.json`.
4. Run `node scripts/build-recordings.mjs`.
5. Add the request text to `EXAMPLES` in `components/Demo.tsx`.
6. Run `npm test` (it checks the recordings are complete and their verdict flags match the text), typecheck, build, and push.
