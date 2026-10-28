# Foundry Portfolio

A personal portfolio site with a live demo of **Foundry**, a multi-agent software factory. Visitors give a rough feature idea for a small task-tracker app and watch eight agents turn it into a pull request draft checked by other agents.

Live site: https://foundry-portfolio.vercel.app

## The pipeline

1. **Researcher** explores the sample codebase with read-only tools (`list_dir`, `read_file`, `grep`) on an in-memory copy of the `taskly-sample` repo.
2. **Story Writer** turns the rough idea into a user story with acceptance criteria.
3. **Project Manager** writes the technical blueprint: data, API and UI.
4. **Backend** and **Frontend** engineers work in parallel.
5. **E2E Verifier** writes a Playwright test for a user flow. In a live run a real headless Chromium runs it against the sample app in a sandbox, next to the app's own unit tests. In the simulation it is an agent reasoning through the flow.
6. **Validator** audits the result against the story's acceptance criteria.
7. **Release** writes the pull request description.

If the E2E Verifier or the Validator rejects the work, it goes back to Backend and Frontend for a second round. All three recorded runs passed on the first round, so no recording has used the send-back. Live runs can: in testing, one live run was sent back by the Validator and passed on the second round. The simulated mode always shows it.

## The stage

The page's centerpiece is a drawing of the pipeline. The active agent glows, finished agents turn green, and a failed check draws a send-back arc. Click any agent to read its full output. Finished runs can be paused, sped up and scrubbed.

## Three modes

| Mode | When | What visitors see |
| --- | --- | --- |
| Replay | One of the three example requests | Genuine Claude output from a real run, played back faster than it ran. Runs in the browser, free, scrubbable. |
| Live | Any request built in the form, when `ANTHROPIC_API_KEY` is set | Each agent calls a real Claude model. The page shows an estimated cost when the run ends. |
| Simulated | Any request built in the form, with no key, over the limits, or while live runs are paused | Scripted text, labelled as such. |

The page labels the mode on every run.

## What is real and what is not

- The three recorded examples are real live runs, each recorded once with `scripts/record-live-runs.ts` and kept as it came out (`recordings-src/live/`, collected into `lib/liveRecordings.json` by `npm run recordings:live`). The site replays them faster than they ran. All three were approved on the first round, include the sample app's real tests and a real browser test, and opened no pull request.
- The agents work on an in-memory copy of a small real repo, [taskly-sample](https://github.com/alexmarushka3-glitch/taskly-sample) (`lib/tasklySnapshot.json`, rebuilt with `node scripts/build-snapshot.mjs`). The engineers write real files into the copy with a `write_file` tool. In a live run, the sample app's real tests (`npm test`) then run on those files in a Vercel Sandbox (`lib/pipeline/sandbox.ts`) with the network off; a failing suite fails the E2E gate.
- In a live run the E2E Verifier writes a Playwright test and a real headless Chromium runs it against the app started in the sandbox (needs `FOUNDRY_SANDBOX_SNAPSHOT`, see below); pictures show in its panel and the real result decides the gate. In the simulation it is an agent reasoning through flows. A live run that passes both checks then opens a real draft pull request on taskly-sample through a GitHub App (`lib/pipeline/github.ts`); a daily Vercel cron (`/api/cron/close-stale-prs`) closes them after a day.

## Getting started

You need Node 20 or newer.

```bash
npm install
npm run dev        # http://localhost:3000
```

With no configuration the site works: the examples replay and requests built in the form run the labelled simulation.

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload. |
| `npm run build` / `npm start` | Production build and server. |
| `npm run typecheck` | TypeScript, no emit. |
| `npm test` | The whole test suite (about 3 seconds, no network, no API key). |
| `npm run test:watch` | Tests in watch mode. |
| `npm run recordings:live` | Rebuild `lib/liveRecordings.json` and `lib/exampleRequests.ts` from `recordings-src/live/`. |

On Windows PowerShell, run `npx.cmd` instead of `npx`.

### Configuration

Copy `.env.example` to `.env.local`. Nothing is required.

| Variable | Default | Meaning |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | none | Turns on live runs for built requests. Never commit it. |
| `FOUNDRY_LIVE` | `on` | `off` turns live runs off even with a key. |
| `FOUNDRY_LIVE_PER_HOUR` | `1` | Live runs per visitor per hour. |
| `FOUNDRY_LIVE_PER_DAY` | `8` | Live runs per day for the whole site. |
| `FOUNDRY_SANDBOX_SNAPSHOT` | none | Id of the prepared sandbox snapshot (repo, dependencies, Chromium). Without it the real browser step is skipped and unit tests use a slower plain clone. Build one with `scripts/build-sandbox-snapshot.mjs`. |
| `GITHUB_APP_ID`, `GITHUB_APP_INSTALLATION_ID`, `GITHUB_APP_PRIVATE_KEY` | none | The GitHub App that opens draft pull requests on taskly-sample. Without them no PR is opened. The key is the .pem text or its base64. |
| `CRON_SECRET` | none | Lets Vercel Cron call `/api/cron/close-stale-prs` to close pull requests older than a day. Without it that route returns 404. |
| `FOUNDRY_MODEL_SMART` / `_BUILD` / `_FAST` | Sonnet 5.5 / Sonnet 5.5 / Haiku 5.5 | Models for each tier. |
| `ADMIN_TOKEN` | none | Turns on the admin dashboard. Use a long random value. |

An empty or invalid number falls back to its default, so `FOUNDRY_LIVE_PER_HOUR=` does not mean "zero runs".

## Live runs and cost

Live runs use Haiku 5.5 for the researcher and release agent, and Sonnet 5.5 for the rest, with thinking switched off and short outputs. Prices come from the Claude API reference. A live run costs roughly $0.10 to $0.30 and takes about a minute. The page shows the estimate for each run. Safeguards:

- A run stops if it passes a $0.25 spending cap.
- A run stops, and stops spending, when the visitor closes the page.
- Limits per visitor and per day. They are shared across instances in Upstash Redis when `KV_REST_API_URL` and `KV_REST_API_TOKEN` are set, and kept per instance in memory otherwise, so without Redis they are a brake and not a hard cap.
- The hard cap is the spend limit set in the Anthropic console. Set one.
- Input is limited to 200 characters. `FOUNDRY_LIVE=off`, or **Pause live runs** in the admin dashboard, turns live runs off at any time.

## Security

- **Headers:** every response carries a Content-Security-Policy limited to the site itself (no framing, no plugins, no other origins), `X-Content-Type-Options`, `X-Frame-Options`, a referrer policy, a permissions policy and a cross-origin opener policy (`lib/securityHeaders.ts`, wired in `next.config.ts`). The policy is left out in development. Admin pages and `/api/admin/*` are never cached.
- **Admin session:** the cookie is HttpOnly, Secure and SameSite=Strict, and holds a signed expiry the server checks, so a copied cookie stops working after 8 hours. State-changing admin requests that a browser says came from another site are refused (`blockCrossSite`). Login is limited to five tries per address per 15 minutes, and the token comparison is constant-time.
- **Inputs:** request bodies are capped at 4 KB (`readJsonBody`). The run form is validated against fixed choices and rebuilt server-side, so visitor text never reaches a prompt. The agents' file writes are allowlisted, and the sandbox runs their code with the network off.
- **Secrets:** only `.env.example` is committed. The GitHub App key, the API key and the admin token live in Vercel. The cron route does not exist without `CRON_SECRET`.
- **Known, not fixed:** `npm audit` reports 6 advisories in build-time and CLI dependencies (`zod` inside `@vercel/sandbox`, `postcss` inside `next`). Neither handles visitor input, and the only fixes are major version changes. Without Redis, live-run limits are per server instance, so the spend limit set in the Anthropic console is the real cap.
- Reviewed against the VibeSec checklist on Oct 26 and 27, 2026.

## Admin dashboard

Set `ADMIN_TOKEN` and open `/admin`. Without a token the page and its API return 404.

- **Overview cards:** runs, live runs, approval rate, average time, estimated cost, errors.
- **Charts:** runs over time by mode, results, average time per agent.
- **Table:** sortable, paged, with per-run details (rounds, tokens, time per agent, error).
- **Filters:** time range, mode, result, and a search over idea text and visitor id.
- **Actions:** pause or resume live runs, reset visitor limits, clear the log, export the filtered runs as CSV.

The run log is in Upstash Redis when `KV_REST_API_URL` and `KV_REST_API_TOKEN` are set. Otherwise it is in memory on one server instance (the last 500 runs) and resets on a restart or cold start. It only sees runs that reach the API; recorded examples replay in the visitor's browser and are not counted. It stores a short hash of each visitor's address, never the address. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how to back it with a database.

### Public sample-data demo

`/admin-demo` is a public, read-only copy of the dashboard for visitors and recruiters. It needs no token, makes no requests to the server, and runs on **made-up** data generated in the browser (`lib/admin/sampleData.ts`). A banner at the top says so, every visitor id starts with `sample-`, and the buttons only change what is on that visitor's screen. The only real data on it is the table of the three recorded examples. A compact version of the same sample dashboard is also on the home page, between the demo and "Scope and limits" (`components/admin/DashboardSection.tsx`). It loads after the page does, so it stays out of the first load.

## Project structure

```
app/            Routes: the page, /admin, /admin-demo, /api/run, /api/admin/*
components/     Stage (and stage/), PipelineSvg, Logo, admin/
lib/            pipeline/ (the agents), server/ (limits, log, auth), admin/ (dashboard maths), run.ts, liveRun.ts, ...
tests/          Vitest suites
recordings-src/ The three real recorded live runs (live/), old text-only ones archived
scripts/        record-live-runs.ts, build-live-recordings.mjs
docs/           ARCHITECTURE.md
```

[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) explains the layers, follows a run end to end, and has recipes for common changes.

## Deploys

Pushes to `main` redeploy the live site automatically through Vercel's GitHub integration. To use the admin dashboard in production, add `ADMIN_TOKEN` to the Vercel environment variables.

## Stack

Next.js, React, TypeScript, streaming NDJSON from a route handler, the Anthropic SDK, Vitest and Testing Library, deployed on Vercel.
