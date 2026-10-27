import Anthropic from "@anthropic-ai/sdk";
import { findServerRecording } from "../server/liveRecordings";
import { serverState } from "../server/state";
import type { AgentName, Emit } from "../types";
import { runAgent, type LlmClient, type RunContext } from "./agentRunner";
import { liveConfigured, liveEnabled, MAX_ROUNDS, MODELS, modelParams, ROUND_TIME_BUDGET_MS } from "./config";
import { AGENT_SPECS } from "./prompts";
import { createGithubClient, formatPullRequest, githubConfigured, type GithubClient } from "./github";
import { replayOnServer } from "./replay";
import {
  createSandboxBrowserRunner,
  createSandboxTestRunner,
  snapshotConfigured,
  type BrowserReport,
  type BrowserRunner,
  type TestReport,
  type TestRunner,
} from "./sandbox";
import { e2ePassed, validatorApproved } from "./verdicts";
import { createWorkspace, type Workspace } from "./workspace";

export type { AgentName, FoundryEvent, Emit, Gate, Mode } from "../types";
export { costOf, liveConfigured, liveEnabled } from "./config";
export type { LlmClient } from "./agentRunner";

export type RunOptions = {
  /** False when the caller has already decided this run may not go live (limits reached). */
  allowLive?: boolean;
  /** Shown to the visitor when a run is a simulation for a reason they should know. */
  reason?: string;
  /** Stop the run, and stop spending, when this aborts (the visitor left). */
  signal?: AbortSignal;
  /** Use this model client instead of the real SDK. For tests. */
  client?: LlmClient;
  /** Runs the sample app's real tests. Defaults to a Vercel Sandbox on live runs; tests pass a fake. */
  testRunner?: TestRunner;
  /** Drives a real browser against the app. Defaults to Chromium in a Vercel Sandbox when a snapshot is set up; tests pass a fake. */
  browserRunner?: BrowserRunner;
  /** Opens the real draft pull request. Defaults to GitHub when the app is set up on live runs; tests pass a fake. */
  github?: GithubClient;
  /** Scales the delays in simulated and replayed runs. 0 skips them. For tests. */
  pace?: number;
};

/** The files the engineers wrote, for the agents that check and describe their work. */
function renderChanges(ws: Workspace): string {
  const entries = Object.entries(ws.changes());
  if (entries.length === 0) return "(no files were written)";
  return entries.map(([path, body]) => `--- ${path} ---\n${body}`).join("\n\n");
}

/** What the checking agents are told about the real test run. */
function describeTests(t: TestReport | undefined): string {
  if (!t) return "Test run: not run in this mode.";
  if (!t.ran) return "Test run: the sandbox was unavailable, so the tests did not run. Judge the files by reading them.";
  return `Test run (real, in a sandbox): ${t.summary}\n${t.output}`;
}

/** What the checking agents are told about the real browser run. */
function describeBrowser(b: { runs: number; last?: BrowserReport } | undefined): string {
  if (!b) return "Browser run: not available in this run.";
  if (b.runs === 0 || !b.last) return "Browser run: the E2E Verifier never ran the real browser test.";
  if (!b.last.ran) return "Browser run: the real browser could not start, so there is no browser result.";
  return `Browser run (real Chromium, in a sandbox): ${b.last.summary}\n${b.last.output}`;
}

const PAUSED_REASON = "Live runs are paused right now, so this run is a simulation.";
const UNAVAILABLE_REASON = "Live mode isn't available right now, so this run is a simulation.";

/**
 * Run the eight-agent pipeline and report progress through `emit`.
 *
 * A recorded example is replayed. Anything else runs live when the server is set up for it and the caller
 * allows it, and otherwise runs the labelled simulation. Throws only for failures the visitor should see.
 */
export async function runPipeline(request: string, emit: Emit, opts: RunOptions = {}): Promise<void> {
  const pace = opts.pace ?? 1;
  const recorded = findServerRecording(request);
  if (recorded) return replayOnServer(recorded, emit, pace);

  const t0 = Date.now();
  const wantLive = opts.allowLive !== false && (opts.client !== undefined || liveEnabled());
  let client: LlmClient | null = wantLive ? (opts.client ?? (new Anthropic() as unknown as LlmClient)) : null;
  let reason = client ? undefined : (opts.reason ?? (liveConfigured() && serverState().admin.livePaused ? PAUSED_REASON : undefined));

  // A one-token check before the real run. If the key is wrong, the account is out of credit,
  // or the API is down, the visitor gets the labelled simulation instead of an error.
  if (client) {
    try {
      await client.messages.create({
        model: MODELS.fast,
        messages: [{ role: "user", content: "Reply with OK." }],
        ...modelParams(MODELS.fast, 16),
      });
    } catch (err) {
      const e = err as { name?: string; status?: number; error?: { error?: { type?: string } } };
      console.error("live check failed, using simulation:", e?.name ?? typeof err, e?.status ?? "", e?.error?.error?.type ?? "");
      client = null;
      reason = UNAVAILABLE_REASON;
    }
  }
  const live = client !== null;
  emit({ type: "mode", mode: live ? "live" : "simulated", reason });

  const workspace = createWorkspace();
  const testRunner = live ? (opts.testRunner ?? (opts.client ? undefined : createSandboxTestRunner())) : undefined;
  const browserRunner = live ? (opts.browserRunner ?? (!opts.client && snapshotConfigured() ? createSandboxBrowserRunner() : undefined)) : undefined;
  const ctx: RunContext = { client, emit, request, workspace, testRunner, browserRunner, spend: { usd: 0 }, signal: opts.signal, pace };
  const step = (agent: AgentName, round: number, input: string) => runAgent(ctx, AGENT_SPECS[agent], round, input);

  const research = await step("researcher", 1, `Request: ${request}\n\nExplore the sample app with your tools.`);
  const story = await step("story", 1, `Request: ${request}\n\nResearch:\n${research}`);
  const blueprint = await step("pm", 1, `Story:\n${story}\n\nResearch:\n${research}`);

  let feedback = "";
  let backend = "";
  let frontend = "";
  let approved = false;
  let roundsRun = 0;
  for (let round = 1; round <= MAX_ROUNDS; round++) {
    if (round > 1 && Date.now() - t0 > ROUND_TIME_BUDGET_MS) break;
    roundsRun = round;
    const fb = feedback ? `\n\nFeedback to address:\n${feedback}` : "";
    [backend, frontend] = await Promise.all([
      step("backend", round, `Blueprint:\n${blueprint}${fb}`),
      step("frontend", round, `Blueprint:\n${blueprint}${fb}`),
    ]);
    const files = renderChanges(workspace);

    let tests: TestReport | undefined;
    ctx.browser = browserRunner ? { runs: 0 } : undefined;
    const flows = await runAgent(
      ctx,
      AGENT_SPECS.e2e,
      round,
      () => `Story:\n${story}\n\nBackend notes:\n${backend}\n\nFrontend notes:\n${frontend}\n\nChanged files:\n${files}\n\n${describeTests(tests)}`,
      async () => {
        if (!testRunner) return;
        tests = await testRunner(workspace.changes(), opts.signal);
        emit({ type: "tool", agent: "e2e", round, label: tests.summary, ok: tests.ok });
      },
    );
    // The real test run decides: an agent saying PASS cannot outvote a failing test suite.
    const testsOk = !tests || !tests.ran || tests.ok;
    const browser = ctx.browser;
    // The same for the real browser: the verifier must have run it, and a failing run fails the gate.
    // If the browser could not start at all (no result), that does not block the run.
    const browserOk = !browser || (browser.runs > 0 && (browser.last?.ran === false || browser.last?.ok === true));
    const flowsPass = e2ePassed(flows) && testsOk && browserOk;
    emit({ type: "verdict", gate: "e2e", round, approved: flowsPass });
    if (!flowsPass) {
      feedback = `${describeTests(tests)}\n\n${describeBrowser(browser)}\n\n${flows}`;
      continue;
    }

    const audit = await step(
      "validator",
      round,
      `Story:\n${story}\n\nChanged files:\n${files}\n\n${describeTests(tests)}\n\n${describeBrowser(browser)}\n\nE2E result:\n${flows}`,
    );
    approved = validatorApproved(audit);
    emit({ type: "verdict", gate: "validator", round, approved });
    if (approved) break;
    feedback = audit;
  }

  const releaseText = await step(
    "release",
    roundsRun,
    `Request: ${request}\n\nBlueprint:\n${blueprint}\n\nChanged files:\n${renderChanges(workspace)}\n\nApproved: ${approved}`,
  );

  // A real draft pull request, only for a live run that passed both checks and has files to show.
  const github = live ? (opts.github ?? (!opts.client && githubConfigured() ? createGithubClient() : undefined)) : undefined;
  if (github && approved && Object.keys(workspace.changes()).length > 0) {
    try {
      const { title, body } = formatPullRequest(releaseText, request);
      const runId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const pr = await github.openPullRequest({ files: workspace.changes(), title, body, runId });
      emit({ type: "tool", agent: "release", round: roundsRun, label: `opened draft pull request #${pr.number}`, ok: true });
      emit({ type: "pr", url: pr.url, number: pr.number });
    } catch (err) {
      console.error("opening the pull request failed:", (err as Error).name, String((err as Error).message).slice(0, 200));
      emit({ type: "tool", agent: "release", round: roundsRun, label: "no pull request opened (GitHub unavailable)", ok: false });
    }
  } else if (github && !approved) {
    emit({ type: "tool", agent: "release", round: roundsRun, label: "no pull request opened: the run did not pass both checks", ok: false });
  }
  emit({ type: "finish", ms: Date.now() - t0, rounds: roundsRun, approved, costUsd: live ? ctx.spend.usd : undefined });
}
