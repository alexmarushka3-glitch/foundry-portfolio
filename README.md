# Foundry Portfolio

A personal portfolio site with a live demo of **Foundry**, a multi-agent software factory. Visitors give a rough feature idea for a small task-tracker app and watch eight agents turn it into a pull request draft checked by other agents.

Live site: https://foundry-portfolio.vercel.app

## The pipeline

1. **Researcher** reads the sample codebase. It is read-only: it only receives the repo text and has no tools.
2. **Story Writer** turns the rough idea into a user story with acceptance criteria.
3. **Project Manager** writes the technical blueprint: data, API and UI.
4. **Backend** and **Frontend** engineers work in parallel.
5. **E2E Verifier** walks full user flows instead of running unit tests.
6. **Validator** audits the result against the story's acceptance criteria.
7. **Release** writes the pull request description.

If the E2E Verifier or the Validator rejects the work, it goes back to Backend and Frontend for a second round. All three recorded runs passed on the first round, so no recording has used the send-back. Live runs can: in testing, one live run was sent back by the Validator and passed on the second round. The simulated mode always shows it.

## The stage

The page's centerpiece is a drawing of the pipeline. The active agent glows, finished agents turn green, and a failed check draws a send-back arc. Click any agent to read its full output. Finished runs can be paused, sped up and scrubbed.

## Three modes

| Mode | When | What visitors see |
| --- | --- | --- |
| Replay | One of the three example requests | Genuine Claude output from a real run, played back faster than it ran. Runs in the browser, free, scrubbable. |
| Live | Any typed idea, when `ANTHROPIC_API_KEY` is set | Each agent calls a real Claude model. The page shows an estimated cost when the run ends. |
| Simulated | Any typed idea, with no key, over the limits, or while live runs are paused | Scripted text, labelled as such. |

The page labels the mode on every run.

## What is real and what is not

- The three recorded runs were made with a separate Claude agent for every stage. The raw outputs are in `recordings-src/`, and `scripts/build-recordings.mjs` assembles them into `lib/recordings.json`. All three passed on the first round.
- The agents worked from a small bundled sample app (`lib/sampleRepo.ts`), not a real codebase. Their code is plausible but was never run.
- The E2E Verifier is an agent reasoning through flows. It does not drive a real browser.

## Getting started

You need Node 20 or newer.

```bash
npm install
npm run dev        # http://localhost:3000
```

With no configuration the site works: the examples replay and typed ideas run the labelled simulation.

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload. |
| `npm run build` / `npm start` | Production build and server. |
| `npm run typecheck` | TypeScript, no emit. |
| `npm test` | The whole test suite (about 3 seconds, no network, no API key). |
| `npm run test:watch` | Tests in watch mode. |
| `node scripts/build-recordings.mjs` | Rebuild `lib/recordings.json` from `recordings-src/`. |

On Windows PowerShell, run `npx.cmd` instead of `npx`.

### Configuration

Copy `.env.example` to `.env.local`. Nothing is required.

| Variable | Default | Meaning |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | none | Turns on live runs for typed ideas. Never commit it. |
| `FOUNDRY_LIVE` | `on` | `off` turns live runs off even with a key. |
| `FOUNDRY_LIVE_PER_HOUR` | `3` | Live runs per visitor per hour. |
| `FOUNDRY_LIVE_PER_DAY` | `40` | Live runs per day for the whole site. |
| `FOUNDRY_MODEL_SMART` / `_BUILD` / `_FAST` | Sonnet 5.5 / Sonnet 5.5 / Haiku 5.5 | Models for each tier. |
| `ADMIN_TOKEN` | none | Turns on the admin dashboard. Use a long random value. |

An empty or invalid number falls back to its default, so `FOUNDRY_LIVE_PER_HOUR=` does not mean "zero runs".

## Live runs and cost

Live runs use Haiku 5.5 for the researcher and release agent, and Sonnet 5.5 for the rest, with thinking switched off and short outputs. Prices come from the Claude API reference. In two test runs the cost was about 5.5 cents (one round, 27 seconds) and 10 cents (two rounds, 42 seconds). The page shows the estimate for each run. Safeguards:

- A run stops if it passes a $0.25 spending cap.
- A run stops, and stops spending, when the visitor closes the page.
- Best-effort limits per visitor and per day. Serverless hosting keeps these counters per instance, so they are a brake and not a hard cap.
- The hard cap is the spend limit set in the Anthropic console. Set one.
- Input is limited to 200 characters. `FOUNDRY_LIVE=off`, or **Pause live runs** in the admin dashboard, turns live runs off at any time.

## Admin dashboard

Set `ADMIN_TOKEN` and open `/admin`. Without a token the page and its API return 404.

- **Overview cards:** runs, live runs, approval rate, average time, estimated cost, errors.
- **Charts:** runs over time by mode, results, average time per agent.
- **Table:** sortable, paged, with per-run details (rounds, tokens, time per agent, error).
- **Filters:** time range, mode, result, and a search over idea text and visitor id.
- **Actions:** pause or resume live runs, reset visitor limits, clear the log, export the filtered runs as CSV.

The run log is in memory on one server instance (the last 500 runs) and resets on a restart or cold start. It only sees runs that reach the API; recorded examples replay in the visitor's browser and are not counted. It stores a short hash of each visitor's address, never the address. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how to back it with a database.

## Project structure

```
app/            Routes: the page, /admin, /api/run, /api/admin/*
components/     Stage (and stage/), PipelineSvg, admin/
lib/            pipeline/ (the agents), server/ (limits, log, auth), admin/ (dashboard maths), run.ts, liveRun.ts, ...
tests/          Vitest suites
recordings-src/ Raw outputs of the three real runs
scripts/        build-recordings.mjs
docs/           ARCHITECTURE.md
```

[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) explains the layers, follows a run end to end, and has recipes for common changes.

## Deploys

Pushes to `main` redeploy the live site automatically through Vercel's GitHub integration. To use the admin dashboard in production, add `ADMIN_TOKEN` to the Vercel environment variables.

## Stack

Next.js, React, TypeScript, streaming NDJSON from a route handler, the Anthropic SDK, Vitest and Testing Library, deployed on Vercel.
