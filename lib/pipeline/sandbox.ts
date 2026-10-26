import { Sandbox } from "@vercel/sandbox";
import snapshot from "../tasklySnapshot.json";

// Runs the sample app's real checks on the agents' files, in a Vercel Sandbox (a throwaway microVM):
//   - its unit tests (npm test), and
//   - a real headless Chromium driving the running app (Playwright).
// Each call gets a fresh sandbox, started from a prepared snapshot (the repo at the pinned commit, with
// dependencies and Chromium installed) when FOUNDRY_SANDBOX_SNAPSHOT is set, else from a plain clone.
// The network is off before any agent-written file is copied in, so the code under test cannot call out or
// reach anything, and no secret is ever placed inside. The sandbox is stopped when the call ends.

export type TestReport = {
  /** False when the sandbox itself could not start or finish, so there is no result at all. */
  ran: boolean;
  ok: boolean;
  /** One short line for the page, for example "npm test: 5 passed, 0 failed". */
  summary: string;
  /** The tail of the output, for the agents to read. */
  output: string;
  ms: number;
};

export type BrowserShot = { label: string; /** PNG, base64. */ png: string };

export type BrowserReport = TestReport & { shots: BrowserShot[] };

/** Run the tests with these files (path -> content) written over the clean repo. */
export type TestRunner = (files: Record<string, string>, signal?: AbortSignal) => Promise<TestReport>;

/** Run a Playwright spec (the E2E agent's) plus the repo's own e2e tests in a real browser, against the app started in the sandbox. */
export type BrowserRunner = (files: Record<string, string>, spec: string, signal?: AbortSignal) => Promise<BrowserReport>;

export const TEST_TIMEOUT_MS = 90_000;
export const BROWSER_TIMEOUT_MS = 100_000;
export const MAX_SPEC_BYTES = 8_000;
export const MAX_SHOTS = 4;
const MAX_SHOT_BYTES = 150_000;
const OUTPUT_TAIL = 2_500;
// Sorts after smoke.spec.js, so the repo's own smoke test (which expects an empty list) runs first.
const SPEC_PATH = "e2e/zz-feature.spec.js";
const RUN_CONFIG = "playwright.run.config.js";

// Not agent-controlled: where Playwright looks, how it starts the app, and that it takes a picture of each test.
const RUN_CONFIG_SOURCE = `import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "e2e",
  outputDir: "/tmp/pw-out",
  timeout: 15000,
  retries: 0,
  workers: 1,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:3000", screenshot: "on", viewport: { width: 640, height: 480 } },
  webServer: { command: "npm start", url: "http://127.0.0.1:3000", reuseExistingServer: false, timeout: 15000 },
});
`;

const tail = (s: string) => (s.length > OUTPUT_TAIL ? `…${s.slice(-OUTPUT_TAIL)}` : s).trim();

/** Pull the counts out of `node --test` output. */
export function summarizeTestOutput(out: string, exitCode: number): string {
  const pass = /^ℹ pass (\d+)/m.exec(out)?.[1];
  const fail = /^ℹ fail (\d+)/m.exec(out)?.[1];
  if (pass !== undefined && fail !== undefined) return `npm test: ${pass} passed, ${fail} failed`;
  return exitCode === 0 ? "npm test passed" : "npm test failed";
}

/** Pull the counts out of Playwright's list reporter. */
export function summarizeBrowserOutput(out: string, exitCode: number): string {
  const passed = /(\d+) passed/.exec(out)?.[1] ?? "0";
  const failed = /(\d+) failed/.exec(out)?.[1] ?? "0";
  if (/(\d+) passed|(\d+) failed/.test(out)) return `real browser: ${passed} passed, ${failed} failed`;
  return exitCode === 0 ? "real browser tests passed" : "real browser tests failed";
}

export const snapshotConfigured = () => Boolean(process.env.FOUNDRY_SANDBOX_SNAPSHOT);

/** A sandbox ready to test: from the snapshot if there is one and it still works, else a fresh clone with dependencies. */
async function openSandbox(signal: AbortSignal | undefined, ms: number): Promise<{ sandbox: Sandbox; fromSnapshot: boolean }> {
  const common = { timeout: ms + 30_000, persistent: false, signal };
  const snapshotId = process.env.FOUNDRY_SANDBOX_SNAPSHOT;
  if (snapshotId) {
    try {
      const sandbox = await Sandbox.create({ ...common, source: { type: "snapshot", snapshotId }, networkPolicy: "deny-all" });
      return { sandbox, fromSnapshot: true };
    } catch (err) {
      if (signal?.aborted) throw err;
      console.error("sandbox snapshot unusable, cloning instead:", (err as Error).name, String((err as Error).message).slice(0, 160));
    }
  }
  const sandbox = await Sandbox.create({
    ...common,
    runtime: "node24",
    source: { type: "git", url: `https://github.com/${snapshot.repo}.git`, revision: snapshot.commit },
  });
  const install = await sandbox.runCommand("npm", ["ci", "--no-audit", "--no-fund"], { signal });
  if (install.exitCode !== 0) {
    await sandbox.stop().catch(() => {});
    throw new InstallFailed(tail((await install.stdout()) + (await install.stderr())));
  }
  // Dependencies are in. From here nothing in the sandbox can reach the network.
  await sandbox.updateNetworkPolicy("deny-all", { signal });
  return { sandbox, fromSnapshot: false };
}

class InstallFailed extends Error {
  constructor(public output: string) {
    super("npm install failed");
  }
}

const toFiles = (files: Record<string, string>) => Object.entries(files).map(([path, content]) => ({ path, content: Buffer.from(content) }));

/** Shared wrapper: start, run `work`, enforce the hard timeout, always stop the sandbox. */
async function withSandbox<R extends TestReport>(
  signal: AbortSignal | undefined,
  hardMs: number,
  unavailable: () => R,
  work: (sandbox: Sandbox, fromSnapshot: boolean, elapsed: () => number) => Promise<R>,
): Promise<R> {
  const t0 = Date.now();
  const elapsed = () => Date.now() - t0;
  let sandbox: Sandbox | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const hard = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("The sandbox run took too long.")), hardMs);
    });
    const run = (async () => {
      const opened = await openSandbox(signal, hardMs);
      sandbox = opened.sandbox;
      return work(opened.sandbox, opened.fromSnapshot, elapsed);
    })();
    run.catch(() => {}); // if the timeout wins, a late failure here must not become an unhandled rejection
    return await Promise.race([run, hard]);
  } catch (err) {
    if (signal?.aborted) throw err;
    if (err instanceof InstallFailed) return { ...unavailable(), ran: true, summary: "npm install failed", output: err.output, ms: elapsed() };
    console.error("sandbox run failed:", (err as Error).name, String((err as Error).message).slice(0, 200));
    return { ...unavailable(), ms: elapsed() };
  } finally {
    clearTimeout(timer);
    await sandbox?.stop().catch(() => {});
  }
}

export function createSandboxTestRunner(): TestRunner {
  return (files, signal) =>
    withSandbox<TestReport>(
      signal,
      TEST_TIMEOUT_MS,
      () => ({ ran: false, ok: false, summary: "Tests could not run (sandbox unavailable)", output: "", ms: 0 }),
      async (sandbox, _snap, elapsed) => {
        if (Object.keys(files).length) await sandbox.writeFiles(toFiles(files), { signal });
        const test = await sandbox.runCommand("npm", ["test"], { signal });
        const out = (await test.stdout()) + (await test.stderr());
        return { ran: true, ok: test.exitCode === 0, summary: summarizeTestOutput(out, test.exitCode), output: tail(out), ms: elapsed() };
      },
    );
}

/** The browser needs Chromium, which only the snapshot has. Without it, the report says the browser could not run. */
export function createSandboxBrowserRunner(): BrowserRunner {
  return async (files, spec, signal) => {
    const none = (summary: string): BrowserReport => ({ ran: false, ok: false, summary, output: "", ms: 0, shots: [] });
    if (!snapshotConfigured()) return none("Real browser unavailable (no sandbox snapshot)");
    if (Buffer.byteLength(spec) > MAX_SPEC_BYTES) return { ...none("Test file too large"), ran: true, output: `The test file is over ${MAX_SPEC_BYTES} bytes. Write a shorter one.` };

    return withSandbox<BrowserReport>(
      signal,
      BROWSER_TIMEOUT_MS,
      () => none("Real browser could not run (sandbox unavailable)"),
      async (sandbox, fromSnapshot, elapsed) => {
        if (!fromSnapshot) return none("Real browser unavailable (snapshot could not be used)");
        await sandbox.writeFiles(
          [...toFiles(files), { path: SPEC_PATH, content: Buffer.from(spec) }, { path: RUN_CONFIG, content: Buffer.from(RUN_CONFIG_SOURCE) }],
          { signal },
        );
        const run = await sandbox.runCommand("bash", ["-lc", `set -o pipefail; timeout 70 npx playwright test -c ${RUN_CONFIG} 2>&1 | tail -c 6000`], { signal });
        const out = await run.stdout();
        const ok = run.exitCode === 0 && /\d+ passed/.test(out);

        const shots: BrowserShot[] = [];
        const listing = await sandbox.runCommand("bash", ["-lc", "ls /tmp/pw-out/*/test-*.png 2>/dev/null | head -8"], { signal });
        for (const path of (await listing.stdout()).split("\n").filter(Boolean)) {
          if (shots.length >= MAX_SHOTS) break;
          const buf = await sandbox.fs.readFile(path).catch(() => null);
          if (!buf || buf.length > MAX_SHOT_BYTES) continue;
          const name = path.split("/").at(-2) ?? "test";
          shots.push({ label: name.replace(/-chromium.*$/, "").replace(/^[^-]+-/, "").replace(/-/g, " ").slice(0, 70), png: Buffer.from(buf).toString("base64") });
        }
        return { ran: true, ok, summary: summarizeBrowserOutput(out, ok ? 0 : 1), output: tail(out), ms: elapsed(), shots };
      },
    );
  };
}
