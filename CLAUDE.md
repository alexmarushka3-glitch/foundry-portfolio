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
- `components/Demo.tsx`: client demo UI. Reads the NDJSON stream and renders agent cards. Backend and Frontend cards of the same round sit side by side.
- `app/api/run/route.ts`: streaming endpoint. Live runs are limited to 5 per hour per IP; replay and simulated runs are free.
- `lib/pipeline.ts`: the eight agents (researcher, story, pm, backend, frontend, e2e, validator, release) and the three modes.
- `lib/sampleRepo.ts`: the small "taskly" app text the Researcher reads. It gets text only and no tools, so it is read-only by construction.
- `recordings-src/`: raw outputs of real runs (`<slug>/N-agent.txt`) plus `meta.json` (models, timings, request text).
- `lib/recordings.json`: generated from `recordings-src/`. Do not edit by hand.

## Modes

1. **Replay:** the request matches a recorded example. Genuine Claude output from a real run, played back faster than it ran.
2. **Live:** custom request and `ANTHROPIC_API_KEY` is set. Each agent calls a real model. Off on the deployed site.
3. **Simulated:** custom request, no key. Scripted text, labelled as such on the page.

## Honesty rules

- The page must always say which mode ran. Never present simulated text as model output.
- Never hand-edit `recordings-src/` text. Replay is only honest if it is the real output.
- The agents worked on a small sample app and their code was never run. The E2E Verifier is an agent walking through flows, not a real browser. Keep those caveats wherever the project is described.
- All three recorded runs passed on the first round, so no recording has exercised the send-back to a second round. Do not say the retry loop was proven; only the simulated mode shows it.
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
