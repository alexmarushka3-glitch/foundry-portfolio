---
name: add-recorded-example
description: Add or re-record a recorded example run on the Foundry Portfolio site (the replays visitors can pick). Use when Alex asks to add, replace or re-record an example, or to record new live runs. It costs real money, so confirm before the recording step.
---

# Add a recorded example

Recorded examples are real live runs kept as they came out. The site replays them; no model is called at replay time. Project rules are in `CLAUDE.md` (Honesty rules); the file map is in `docs/ARCHITECTURE.md`.

## Before you start

- Recording spends real money (about $0.20 a run). Tell Alex the number of runs and the cost, and get a yes before running the command in step 3.
- Never print, log or commit env values. `.env.local`, `.env.sandbox.local` and `.env.eval.local` are gitignored; only `.env.example` is committed.
- Never hand-edit or cherry-pick events in `recordings-src/live/`. Keep each run as it came out.
- Do not merge the PR. Open it, give Alex the link and wait.

## Steps

1. Add the request to the plan in `lib/eval/plan.ts` (or pass the count to `--requests`); the script records the first N planned requests.
2. Put `ANTHROPIC_API_KEY` in `.env.local`, the sandbox login in `.env.sandbox.local` and `FOUNDRY_SANDBOX_SNAPSHOT` in `.env.eval.local` (all gitignored; never print them).
3. Run `npx.cmd vite-node scripts/record-live-runs.ts -- --requests N --confirm`. To re-record an existing example, first move its file out of `recordings-src/live/` and run `npm run recordings:live`: the script skips existing files, and a request that matches a shipped recording is replayed instead of run live (the recorder then refuses it). It writes `recordings-src/live/<slug>.json`. Keep each run as it came out; never edit or cherry-pick events.
4. Run `npm run recordings:live` to rebuild `lib/liveRecordings.json`, the per-example chunks and `lib/exampleRequests.ts`.
5. Run `npm test` (the recorder, replay and example-request tests check shape, size, secrets and that the shipped request list matches the recordings), `npm run typecheck`, `npm run build`, then push.
6. Re-check any numbers in `lib/reality.ts` and `lib/profile.ts` against the new files.

On Windows PowerShell, run `npx.cmd` instead of `npx`.
