# Foundry Portfolio

A personal portfolio site built around **Foundry**, an eight-agent app builder. Visitors type an idea for a small one-page app and watch eight agents plan, build and test it. Then they use the app on the page or save it as one .html file.

Live site: https://alexmarushka.vercel.app (the old address, https://foundry-portfolio.vercel.app, still works)

## The pipeline

1. **Researcher** reads the starter kit (`lib/starter.ts`) with read-only tools (`list_dir`, `read_file`, `grep`).
2. **Story Writer** turns the idea into a user story with acceptance criteria, or refuses it (`REFUSE: ...`) if it is harmful, collects logins or payment details, or needs the internet.
3. **Project Manager** writes the blueprint: function names, element ids and labels, tests.
4. **Logic** (`app.js` and unit tests) and **Interface** (`index.html`, `style.css`, `ui.js`) engineers work in parallel.
5. **Browser Tester** writes a Playwright test. In a live run a real headless Chromium runs it against the bundled app in a sandbox, after the app's unit tests. In the simulation it is an agent reasoning through the flow.
6. **Validator** checks the result against the story and for network use.
7. **Release** writes a short how-to note for the visitor.

If the Browser Tester or the Validator rejects the work, it goes back to the engineers for one more round. The simulated mode always shows a send-back.

## The stage

The page's centerpiece is a drawing of the pipeline. The active agent glows, finished agents turn green, and a failed check draws a send-back arc. Click any agent to read its full output. Finished runs can be paused, sped up and scrubbed.

## Three modes

| Mode | When | What visitors see |
| --- | --- | --- |
| Replay | One of the three example requests | Genuine Claude output from a real run, played back faster than it ran. Runs in the browser, free, scrubbable. |
| Live | A typed idea, when `ANTHROPIC_API_KEY` is set | Each agent calls a real Claude model. If both checks pass, the finished app appears on the page with a save button. |
| Simulated | A typed idea with no key, over the limits, or while live runs are paused | Scripted text, labelled as such. No app is built. |

The page labels the mode on every run.

## What is real and what is not

- The three recorded examples are real live runs, recorded with `scripts/record-live-runs.ts` and kept as they came out (`recordings-src/live/`, collected into `lib/liveRecordings.json` by `npm run recordings:live`). The site replays them faster than they ran, and each ends with its finished app.
- The agents work on an in-memory copy of the starter kit (`lib/pipeline/workspace.ts`), each allowed to write only its own files. In a live run the app's unit tests (`npm test`, `node --test`) run in a Vercel Sandbox (`lib/pipeline/sandbox.ts`) with the network off; a failing suite fails the gate.
- With `FOUNDRY_SANDBOX_SNAPSHOT` set, the files are bundled into one .html file (`lib/bundle.ts`) and a real headless Chromium runs a smoke test and the Browser Tester's test against it in the sandbox; pictures show in its panel and the real result decides the gate.
- The finished app runs on the page in a sandboxed iframe with no network (`public/preview/`) and an in-memory storage stand-in, so nothing is kept there. The saved file is the same bundle and uses the browser's own storage. Where downloads are blocked (some company laptops), "Open full screen" and "Copy the code" work without one, and "Get a link" (needs the Redis database) gives a link that opens the app in a browser tab for 7 days. It runs sealed and keeps nothing.
- No human reviews the apps. Runs no longer open pull requests; the old GitHub App code (`lib/pipeline/github.ts`) is only used by a daily cron that closes old drafts on taskly-sample.

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
| `npm run recordings:live` | Rebuild `lib/liveRecordings.json` and `lib/exampleRequests.ts` from `recordings-src/live/`. |

On Windows PowerShell, run `npx.cmd` instead of `npx`.

### Configuration

Copy `.env.example` to `.env.local`. Nothing is required.

| Variable | Default | Meaning |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | none | Turns on live runs for built requests. Never commit it. |
| `FOUNDRY_LIVE` | `on` | `off` turns live runs off even with a key. |
| `FOUNDRY_LIVE_PER_HOUR` | `2` | Live runs per browser per hour (a random id in an HttpOnly cookie, used only for this limit). |
| `FOUNDRY_LIVE_PER_NETWORK_HOUR` | `6` | Live runs per network (IP address) per hour, shared by every browser on it, so people on one Wi-Fi each get their own runs without cookie-clearing giving endless ones. |
| `FOUNDRY_LIVE_PER_DAY` | `12` | Live runs per day for the whole site. |
| `FOUNDRY_SHARE` | on | Set to `off` to stop making app links and stop opening existing ones (the off switch for abuse). |
| `FOUNDRY_SHARE_PER_HOUR` | `5` | App links per address per hour. |
| `FOUNDRY_SHARE_PER_DAY` | `40` | App links per day for the whole site (links last 7 days, so this bounds how many exist). |
| `FOUNDRY_SANDBOX_SNAPSHOT` | none | Id of the prepared sandbox snapshot (repo, dependencies, Chromium). Without it the real browser step is skipped and unit tests use a slower plain clone. Build one with `scripts/build-sandbox-snapshot.mjs`. |
| `GITHUB_APP_ID`, `GITHUB_APP_INSTALLATION_ID`, `GITHUB_APP_PRIVATE_KEY` | none | The GitHub App the daily cron uses to close old draft pull requests on taskly-sample (runs open none now). The key is the .pem text or its base64. |
| `CRON_SECRET` | none | Lets Vercel Cron call `/api/cron/close-stale-prs` to close pull requests older than a day. Without it that route returns 404. |
| `FOUNDRY_MODEL_SMART` / `_BUILD` / `_FAST` | Sonnet 5.5 / Sonnet 5.5 / Haiku 5.5 | Models for each tier. |
| `ADMIN_TOKEN` | none | Turns on the admin dashboard. Use a long random value. |

An empty or invalid number falls back to its default, so `FOUNDRY_LIVE_PER_HOUR=` does not mean "zero runs".

## Live runs and cost

Live runs use Haiku 5.5 for the researcher and release agent, and Sonnet 5.5 for the rest, with thinking switched off and short outputs. Prices come from the Claude API reference. A live run takes a couple of minutes. The page shows the estimated cost of each run. Safeguards:

- A run stops if it passes a $0.60 spending cap.
- A run stops, and stops spending, when the visitor closes the page.
- Limits per browser, per network and per day. They are shared across instances in Upstash Redis when `KV_REST_API_URL` and `KV_REST_API_TOKEN` are set, and kept per instance in memory otherwise, so without Redis they are a brake and not a hard cap.
- The hard cap is the spend limit set in the Anthropic console. Set one.
- Ideas are limited to 160 characters, and ideas asking for logins or payment details are turned down before any agent runs. `FOUNDRY_LIVE=off`, or **Pause live runs** in the admin dashboard, turns live runs off at any time.

## Security

- **Headers:** every response carries a Content-Security-Policy limited to the site itself (no framing, no plugins, no other origins), `X-Content-Type-Options`, `X-Frame-Options`, a referrer policy, a permissions policy and a cross-origin opener policy (`lib/securityHeaders.ts`, wired in `next.config.ts`). The policy is left out in development. Admin pages and `/api/admin/*` are never cached.
- **Admin session:** the cookie is HttpOnly, Secure and SameSite=Strict, and holds a signed expiry the server checks, so a copied cookie stops working after 8 hours. State-changing admin requests that a browser says came from another site are refused (`blockCrossSite`). Login is limited to five tries per address per 15 minutes, and the token comparison is constant-time.
- **Inputs:** request bodies are capped at 4 KB (`readJsonBody`). The visitor's idea is cleaned and checked (`validateIdea`), and the agents are told it is data, not instructions. The agents' file writes are allowlisted, the sandbox runs their code with the network off, and the finished app runs in a sandboxed frame whose CSP allows no network (`previewHeaders`).
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

`/admin-demo` is a public, read-only copy of the dashboard for visitors and recruiters. It needs no token, makes no requests to the server, and runs on **made-up** data generated in the browser (`lib/admin/sampleData.ts`). A banner at the top says so, every visitor id starts with `sample-`, and the buttons only change what is on that visitor's screen. The only real data on it is the table of the three recorded examples.

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
