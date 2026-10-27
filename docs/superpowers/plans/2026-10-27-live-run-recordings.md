# Live-run recordings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the three stale text-only recorded examples with replays of real live runs (tools, real tests, real browser test, send-backs shown as they happened).

**Architecture:** A recorder script runs the real pipeline once per request and saves the timed `FoundryEvent` stream. The browser rebuilds a scrubbable `Run` by folding those events through the existing `applyEvent`/`toRun` (`lib/liveRun.ts`), compressing time. The old recording path (`lib/recordings.json`, `buildReplayRun`) is removed in the last task.

**Tech Stack:** TypeScript, Next.js, Vitest, vite-node, existing `lib/pipeline` and `lib/liveRun.ts`.

**Spec:** the chat decision of Oct 27, 2026 ("replace the stale recordings with real live-run replays") plus the honesty rules in `CLAUDE.md` and `CLAUDE.local.md`. No separate spec file.

## Global Constraints

- Never hand-edit recorded events. A recording is whatever the run produced.
- Page copy: say "pull request draft checked by other agents and real tests", never "reviewed pull request"; never "passed review".
- The page must say which mode ran. A replay is labelled as a replay of a real live run, and says it opened no pull request.
- Record once per request, keep the outcome (approved, sent back, or not approved). A run with no `finish` event (error) is discarded and may be retried once. No cherry-picking approved runs.
- Never read or print `.env*` files or keys. No API key, sandbox token or env value may appear in a recording.
- Live recording costs money (about $0.18 to $0.31 a run): needs `--confirm`.
- Do not push to main without asking. Do not claim a success rate.
- Initial page bundle must not grow by the recordings: load them with dynamic `import()` on first replay.

## Review Focus

- A recorded run with two rounds (the same agent appears twice): the replay must show round 2 after round 1.
- A recording with no `finish` event (run errored): the recorder refuses to save it.
- Large browser screenshots (base64 PNG) bloating the page: recordings load lazily and the recorder refuses a file over 1.5 MB.
- A secret string (`sk-ant`, `vcp_`, `ghp_`, `BEGIN PRIVATE KEY`) appearing in an event: the recorder refuses to save.
- Request matching still tolerant of case, spaces and trailing punctuation, like `findRecording` today.
- Reduced motion: the first example shows finished, no animation.
- `POST /api/run` with a recorded request still streams a replay and calls no model.

---

### Task 1: Recorder core and script

**Files:**
- Create: `lib/recorder/capture.ts`
- Create: `scripts/record-live-runs.ts`
- Test: `tests/recorderCapture.test.ts`

**Interfaces:**
- Produces:
  - `type TimedEvent = { at: number; event: FoundryEvent }` (`at` = ms since the run started)
  - `type LiveRecording = { slug: string; request: string; recordedAt: string; events: TimedEvent[]; approved: boolean; rounds: number; totalMs: number; costUsd: number }`
  - `captureRun(slug: string, request: string, run: (emit: Emit) => Promise<void>, now?: () => number): Promise<LiveRecording>`; throws `Error` if no `finish` event, if the first `mode` event is not `live`, or if any event text contains a secret pattern; `costUsd` is the sum of `usage` events.
  - `assertRecordingSize(json: string): void` throws over 1_500_000 characters.
- Consumes: `runPipeline` from `lib/pipeline`, `planBatch`/`UPPER_COST_PER_RUN_USD` from `lib/eval/plan`, env-loading pattern from `scripts/run-eval.ts`.

- [ ] **Step 1: Write failing tests** in `tests/recorderCapture.test.ts`: (a) a fake `run` emitting mode live, start, token, done, verdict, finish yields a `LiveRecording` with `approved`, `rounds`, ordered `at` values from an injected clock and summed `costUsd`; (b) no `finish` rejects with `/finish/`; (c) a `mode: "simulated"` first event rejects with `/live/`; (d) a token containing `sk-ant-abc` rejects with `/secret/`; (e) `assertRecordingSize("x".repeat(1_500_001))` throws.
- [ ] **Step 2: Run** `npx.cmd vitest run tests/recorderCapture.test.ts`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement `lib/recorder/capture.ts`** per the interfaces above. Pure, no env or network.
- [ ] **Step 4: Run the same test.** Expected: PASS.
- [ ] **Step 5: Implement `scripts/record-live-runs.ts`.** Same env loading and `--confirm` guard as `scripts/run-eval.ts`; refuses without `ANTHROPIC_API_KEY` and `FOUNDRY_SANDBOX_SNAPSHOT`; takes `--requests <n>` (uses the first n of `planBatch(4).requests`); for each, calls `captureRun` around `runPipeline(request, emit)` (no GitHub env, so no pull request is opened), runs `assertRecordingSize`, and writes `recordings-src/live/<slug>.json`. On a thrown error it logs the message and retries that request once. Prints approved/rounds/cost/ms per run.
- [ ] **Step 6: Run** `npm run typecheck`. Expected: no errors.
- [ ] **Step 7: Commit** `Add recorder for live runs`.

### Task 2: Build step and replay run

**Files:**
- Create: `scripts/build-live-recordings.mjs` (collects `recordings-src/live/*.json` into `lib/liveRecordings.json`, sorted by `slug`)
- Create: `lib/liveReplay.ts`
- Modify: `lib/run.ts` (add optional `source?: "live-run"` to `Run`)
- Test: `tests/liveReplay.test.ts`

**Interfaces:**
- Produces:
  - `buildLiveReplayRun(rec: LiveRecording): Run`: folds `rec.events` with `startLive`/`applyEvent` using `at * TIME_SCALE` (`TIME_SCALE = 0.2`, each step at least 900 ms long), then `toRun`; returns it with `mode: "replay"`, `source: "live-run"`, `costUsd` kept, `pr` undefined.
  - `normalizeRequest(s: string): string` (same rule as `lib/run.ts` `normalize`: trim, lowercase, strip trailing `.!?`; export one shared function from `lib/run.ts` and import it here).
  - `findLiveRecording(recs: LiveRecording[], request: string): LiveRecording | undefined`.
- Consumes: `LiveRecording`, `TimedEvent` (Task 1); `applyEvent`, `startLive`, `toRun` from `lib/liveRun.ts`.

- [ ] **Step 1: Write failing tests** in `tests/liveReplay.test.ts` using a hand-built two-round recording: steps for round 2 start after round 1 ends (`start`/`end` ordering); `run.mode === "replay"` and `run.source === "live-run"`; `run.total` is smaller than the real `totalMs` and positive; `viewsAt(run, run.total)` has a done frame per agent with `passed` set on e2e and validator; `findLiveRecording` ignores case, spacing and trailing `!!`.
- [ ] **Step 2: Run** `npx.cmd vitest run tests/liveReplay.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `lib/liveReplay.ts` and the `Run.source` field. One-line approach: scale event times, then reuse the live reducer so replay and live paths cannot drift.
- [ ] **Step 4: Run** the test, then `npm test`. Expected: PASS, nothing else broken.
- [ ] **Step 5: Implement** `scripts/build-live-recordings.mjs`; it writes `{ "recordings": [...] }` and prints request, approved, rounds, cost per file. Add `"recordings:live": "node scripts/build-live-recordings.mjs"` to `package.json` scripts.
- [ ] **Step 6: Commit** `Add live-run replay builder`.

### Task 3: Show live-run replays on the stage

**Files:**
- Modify: `components/Stage.tsx`, `components/stage/IdeaForm.tsx`, `lib/run.ts` (`EXAMPLE_REQUESTS` source), `lib/pipeline/index.ts` and `lib/pipeline/replay.ts` (server replay of events, paced by `pace`)
- Test: `tests/Stage.test.tsx`, `tests/pipeline.test.ts`, `tests/run.test.ts`

**Interfaces:**
- Consumes: `lib/liveRecordings.json` (Task 2), `buildLiveReplayRun`, `findLiveRecording`.
- Produces: `loadLiveRecordings(): Promise<LiveRecording[]>` in `lib/liveReplay.ts` (dynamic `import("./liveRecordings.json")`, memoised); `EXAMPLE_REQUESTS` derived from the recordings' `request` list via a small static array `EXAMPLE_REQUESTS` kept in `lib/exampleRequests.ts` (written by the build script so the form can list examples without loading screenshots).
- `MODE_COPY.replay` in `components/Stage.tsx` for `source === "live-run"`: label `Replay of a real live run`; detail `Genuine output of a live run on Claude models, with the sample app's real tests and a real browser test in a sandbox, played back faster than it ran. This recording opened no pull request.`

- [ ] **Step 1: Write failing tests**: Stage test that clicking the first example shows the label `Replay of a real live run`, shows at least one tool line (`›`) in the focused agent's output, and does not call `fetch` for `/api/run`; with `prefers-reduced-motion` the run shows finished; `pipeline.test.ts` that a recorded request emits `mode: replay`, then the recorded events, and never calls the model client; `run.test.ts` that `EXAMPLE_REQUESTS` equals the recordings' requests. These tests use a small fixture recording passed through a `vi.mock("@/lib/liveRecordings.json")`.
- [ ] **Step 2: Run** the three test files. Expected: FAIL.
- [ ] **Step 3: Implement** the wiring: `Stage.startReplay` awaits `loadLiveRecordings()`, then `findLiveRecording`, then `setRun(buildLiveReplayRun(rec))`; `useOnceInView` and reduced-motion paths use the same loader; server `replayOnServer` re-emits `rec.events` waiting `(at - elapsed) * pace` between events; update the example-line copy in `IdeaForm.tsx` to say the examples replay real live runs.
- [ ] **Step 4: Run** `npm test` and `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `Replay live-run recordings on the stage`.

### Task 4: Record the real runs (costs money)

**Files:**
- Create: `recordings-src/live/<slug>.json` (generated), update `lib/liveRecordings.json`, `lib/exampleRequests.ts` (generated)

- [ ] **Step 1: Ask Alex to confirm the spend** (3 requests, about $0.60, upper estimate $1.05) and that a fresh sandbox token exists (`npx.cmd vercel@latest env pull .env.sandbox.local --environment=development --yes`).
- [ ] **Step 2: Run** `npx.cmd vite-node scripts/record-live-runs.ts -- --requests 3 --confirm`. Expected: three lines each with approved, rounds, cost, seconds; three files under `recordings-src/live/`.
- [ ] **Step 3: Run** `npm run recordings:live`. Expected: prints the three requests.
- [ ] **Step 4: Check by eye** in the dev server (`preview_start`): replay each recording, scrub, confirm tool lines, test output and browser screenshots show and nothing private appears; check file sizes (`ls -l recordings-src/live lib/liveRecordings.json`).
- [ ] **Step 5: Run** `npm test`. Expected: PASS.
- [ ] **Step 6: Commit** `Record three live runs`. Do not push yet.

### Task 5: Retire the old recordings and fix the copy

**Files:**
- Delete: `lib/recordings.json`, `scripts/build-recordings.mjs`; move `recordings-src/{due-date,priority,search}` and `recordings-src/meta.json` to `recordings-src/archive-text-only/`
- Modify: `lib/run.ts` (remove `Recording`, `findRecording`, `buildReplayRun`, old `EXAMPLE_REQUESTS`), `lib/admin/recorded.ts` (summarise `LiveRecording`s: request, rounds, approved, totalMs, models from `start` events, costUsd), `lib/reality.ts`, `lib/profile.ts`, `components/admin/AdminView.tsx`, `CLAUDE.md`, `docs/ARCHITECTURE.md`, `README.md`, `tests/run.test.ts`, `tests/copy.test.ts`

- [ ] **Step 1: Update tests first**: `tests/run.test.ts` drops the old recording tests; `tests/copy.test.ts` adds assertions that the "What's real" copy no longer says the examples come from the older text-only version, says the replays come from real live runs, says the recordings opened no pull request, and still contains none of `reviewed pull request` / `passed review`.
- [ ] **Step 2: Run** `npm test`. Expected: FAIL on the new copy tests and on removed imports.
- [ ] **Step 3: Remove the old path and update the dependents** listed above. Copy points to keep exact: replays are "played back faster than they ran"; each request was recorded once and kept as it came out; recordings opened no pull request; no human reviewed anything; "three recorded runs make a demo, not a success rate". Replace the line in `reality.ts` that says no recording needed the send-back round with the true statement for the new recordings (read the recordings first and say how many rounds each took).
- [ ] **Step 4: Update `CLAUDE.md`**: Modes (Replay), the honesty rule about recordings and the "Adding a recorded example" section (new steps: `record-live-runs.ts`, `npm run recordings:live`, tests). Update `CLAUDE.local.md` claims (private note, not committed).
- [ ] **Step 5: Run** `npm test`, `npm run typecheck`, `npm run build`. Expected: all pass.
- [ ] **Step 6: Commit** `Retire text-only recordings; copy now describes live-run replays`.
- [ ] **Step 7: Ask Alex before pushing to main**, then push, and check the live site replay.

## Self-review notes

- Spec coverage: record real runs (T1, T4), replay with tools/tests/browser (T2, T3), honest labelling and copy (T3, T5), old stale recordings removed (T5).
- Type consistency: `LiveRecording`, `TimedEvent`, `buildLiveReplayRun`, `findLiveRecording`, `loadLiveRecordings` are defined once (T1, T2, T3) and used by name afterwards.
- Open choice left to the implementer: which three of the four planned requests to record (default: the first three from `planBatch(4)`).
