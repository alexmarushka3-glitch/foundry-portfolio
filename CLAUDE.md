# Foundry Portfolio

Portfolio site with a live demo of Foundry, an eight-agent software factory. Visitors give a rough idea for a small task-tracker app and watch agents turn it into a pull request draft checked by other agents. Live at https://foundry-portfolio.vercel.app.

## Commands

```bash
npm install
npm run dev          # http://localhost:3000
npm run typecheck
npm run build
node scripts/build-recordings.mjs   # rebuild lib/recordings.json from recordings-src/
```

On Windows PowerShell, run `npx.cmd` instead of `npx` (the `npx.ps1` script is blocked by the execution policy).

## Layout

- `lib/profile.ts`: all page copy (name, hero line, About, projects, links). Edit this to change the site text.
- `app/page.tsx`, `app/layout.tsx`, `app/globals.css`: the page and styles.
- `components/Stage.tsx`: the live agent view. Replays recorded runs in the browser (a pure function of time, so it can be scrubbed), streams typed ideas from the server, and turns a finished stream into a scrubbable run. `components/PipelineSvg.tsx` draws the pipeline.
- `lib/run.ts`: the run model (steps on a timeline, frames at a moment). Safe for browser and server. `lib/agents.ts` lists the eight agents; `lib/types.ts` holds shared types.
- `app/api/run/route.ts`: GET says whether live runs are on. POST streams a run. Live runs have per-visitor and per-day brakes; replays and simulations are free.
- `lib/pipeline.ts`: the eight agents (researcher, story, pm, backend, frontend, e2e, validator, release), live model calls with cost tracking, and the simulation.
- Design: light page, dark stage; Schibsted Grotesk and JetBrains Mono (mono only for agent output). Motion answers a user action, respects reduced motion, and animates only transform and opacity.
- `lib/sampleRepo.ts`: the small "taskly" app text the Researcher reads. It gets text only and no tools, so it is read-only by construction.
- `recordings-src/`: raw outputs of real runs (`<slug>/N-agent.txt`) plus `meta.json` (models, timings, request text).
- `lib/recordings.json`: generated from `recordings-src/`. Do not edit by hand.

## Modes

1. **Replay:** the request matches a recorded example. Genuine Claude output from a real run, played back faster than it ran.
2. **Live:** typed idea and `ANTHROPIC_API_KEY` is set (and `FOUNDRY_LIVE` is not `off`). Each agent calls a real model. Costs money: keep the Anthropic console spend limit in place. Live models need thinking switched off and effort low (see `modelParams` in `lib/pipeline.ts`), or thinking tokens eat the short output limit.
3. **Simulated:** typed idea with no key, or over the live limits. Scripted text, labelled as such on the page.

## Honesty rules

- The page must always say which mode ran. Never present simulated text as model output.
- Never hand-edit `recordings-src/` text. Replay is only honest if it is the real output.
- The agents worked on a small sample app and their code was never run. The E2E Verifier is an agent walking through flows, not a real browser. Keep those caveats wherever the project is described.
- All three recorded runs passed on the first round, so no recording has exercised the send-back to a second round. A live test run (Oct 24, 2026) was sent back once by the Validator and passed on round two, so the loop works, but that run was not recorded. Do not claim a success rate.
- Do not commit `.env*` files (only `.env.example`) or `.vercel/`.

## Deploying

Pushes to `main` redeploy automatically through the Vercel GitHub integration (project `foundry-portfolio`). Manual deploy: `npx.cmd vercel@latest deploy --prod --yes`.

## Adding a recorded example

1. Run the eight stages as separate agents on a new request. Pass each stage the previous stage's real output.
2. Save each output as `recordings-src/<slug>/1-researcher.txt` through `8-release.txt`.
3. Add the request and per-stage timings (ms) to `recordings-src/meta.json`.
4. Run `node scripts/build-recordings.mjs`.
5. Add the request text to `EXAMPLES` in `components/Demo.tsx`.
6. Typecheck, build, and push.
