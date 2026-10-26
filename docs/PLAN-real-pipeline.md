# Plan: make Foundry real

Goal: close the four honesty gaps in the site copy. Today the agents get a vague idea, work on pasted text with no tools, never run their code, and the E2E step is an agent. After this plan: a specific request, tool-using agents, code that runs, a real browser, and a real GitHub pull request.

**Status (Oct 26, 2026): stages 0 to 6 are built and live.** What turned out differently from the plan below:

- Each sandbox call starts from a prepared snapshot (repo, packages, Chromium), built from the /admin button, instead of cloning and installing every time. A snapshot made outside production was invisible to production runs.
- The E2E Verifier does not get click-by-click browser tools. It writes one Playwright spec and calls `run_browser_test`; the sandbox runs it plus the repo's smoke test and returns the real result and screenshots.
- The pull request is a draft, opened only for a run that passed both checks, and a daily cron closes them. Engineers can also call `run_tests`.
- Real costs: about $0.18 to $0.31 and 55 to 90 seconds per live run. Live limits are 1 per visitor per hour and 8 per day.
- The three recorded examples are from the old text-only version and the page says so.

Decisions (Oct 25, 2026): Vercel Sandbox for running code, a new public `taskly-sample` repo for PRs, structured input fields, plan first then build stage by stage.

## Target flow

1. Visitor fills fields (feature type + short fields) -> server builds a precise spec.
2. Server creates a Vercel Sandbox, clones `taskly-sample` at a pinned commit, installs deps.
3. Researcher: tools `read_file`, `list_dir`, `grep` (read-only, scoped to the clone).
4. Story Writer, PM: text only, as now.
5. Backend + Frontend (parallel): tools `read_file`, `write_file` (allowlisted paths), `run_tests`. Real files change in the sandbox.
6. Test gate: `npm test`, `tsc`, `lint` run in the sandbox. Failures go back to the engineers (cap 2 loops).
7. E2E Verifier: starts the app in the sandbox, drives it with Playwright tools (`goto`, `click`, `fill`, `expect_text`, `screenshot`). Screenshots stream to the page.
8. Validator: sees diff + real test output + E2E trace. Can send back (as now).
9. Release: creates branch `foundry/<runid>`, commits, opens a real PR on `taskly-sample` through a GitHub App token scoped to that one repo. Returns the PR URL.

## Stages (each ships on its own)

**Stage 0: Sample repo.** Create `alexmarushka3-glitch/taskly-sample`: small Next or Express + SQLite task tracker with tests and a Playwright smoke test. Replace `lib/sampleRepo.ts` text with a real repo. Honest copy changes wait until each stage is live.

**Stage 1: Structured input.** Replace the free text box with fields. Update `IdeaForm`, `app/api/run/route.ts` validation, `lib/types.ts` request type, recordings keys. Recorded examples stay as presets.

**Stage 2: Tools for agents.** Extend `agentRunner.ts` to the Messages API tool loop (`tool_use` / `tool_result`), with per-agent tool lists in `prompts.ts` and caps (max turns, max tokens, wall time). Stream tool calls as new `FoundryEvent` types so the stage shows them.

**Stage 3: Sandbox + real code run.** Add `lib/pipeline/sandbox.ts` wrapping `@vercel/sandbox`: create, clone, write, exec, destroy (always in `finally`). Test gate between build and verify. Needs `maxDuration` raised (Pro: 300s; check plan) or move runs to a queue.

**Stage 4: Real browser E2E.** Playwright in the sandbox against the running app. Verifier agent gets browser tools. Show screenshots in the OutputPanel. Remove "E2E is an agent" caveat only after this passes live.

**Stage 5: Real PR.** GitHub App with `contents:write` and `pull_requests:write` on `taskly-sample` only. Release agent calls `open_pr`. Bot closes PRs after 24h and deletes branches. Page shows the PR link.

**Stage 6: Copy and honesty pass.** Update `lib/profile.ts`, `lib/reality.ts`, CLAUDE.md honesty rules, `tests/copy.test.ts`, README, resume bullet, claude.ai Library. Only claim what a recorded real run shows.

## Risks and brakes

- **Untrusted input runs code.** Structured fields (no free text into shell), no network from the sandbox except npm registry and the model API, no secrets in the sandbox, hard timeout, destroy on abort. The agent never gets the GitHub token: only the server's `open_pr` function does.
- **Cost.** Live run is about $0.05 to $0.10 now. Tool loops and sandbox time will raise it, probably $0.30 to $1. Keep per-visitor (3/hr) and daily brakes, lower daily cap, and set a budget alert. Replays stay free.
- **Spam PRs.** Cap PRs per day, require the run to pass tests first, auto-close.
- **Flaky runs.** Pin repo commit and Node version, retry install once, show a clear failure state. Do not claim a success rate.
- **Vercel limits.** Function duration and Sandbox plan limits must be checked before Stage 3.

## Open questions for Alex

1. Vercel plan (Hobby or Pro)? Sandbox and 300s functions may need Pro.
2. OK to create the public `taskly-sample` repo and a GitHub App on your account?
3. Daily live-run cap and spend ceiling you are comfortable with.

## Recommended order

Stage 0 and 1 first (cheap, no new risk), then 2, 3, 4, 5. Stop after any stage if it looks good enough to post.
