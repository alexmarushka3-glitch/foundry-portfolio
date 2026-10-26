import { Sandbox } from "@vercel/sandbox";
import snapshot from "../tasklySnapshot.json";

// Runs the sample app's real tests on the agents' files, in a Vercel Sandbox (a throwaway microVM).
// The sandbox clones the public taskly-sample repo at the pinned commit and installs its dependencies,
// then its network is switched off before any agent-written file is copied in, so the code under test
// cannot call out or reach anything. No secret is ever placed inside it. It is stopped when the run ends.

export type TestReport = {
  /** False when the sandbox itself could not start or finish, so there is no test result at all. */
  ran: boolean;
  ok: boolean;
  /** One short line for the page, for example "npm test: 5 passed, 0 failed". */
  summary: string;
  /** The tail of the test output, for the agents to read. */
  output: string;
  ms: number;
};

/** Run the tests with these files (path -> content) written over the clean repo. */
export type TestRunner = (files: Record<string, string>, signal?: AbortSignal) => Promise<TestReport>;

export const TEST_TIMEOUT_MS = 90_000;
const OUTPUT_TAIL = 2_500;

const tail = (s: string) => (s.length > OUTPUT_TAIL ? `…${s.slice(-OUTPUT_TAIL)}` : s).trim();

/** Pull the counts out of `node --test` output. */
export function summarizeTestOutput(out: string, exitCode: number): string {
  const pass = /^ℹ pass (\d+)/m.exec(out)?.[1];
  const fail = /^ℹ fail (\d+)/m.exec(out)?.[1];
  if (pass !== undefined && fail !== undefined) return `npm test: ${pass} passed, ${fail} failed`;
  return exitCode === 0 ? "npm test passed" : "npm test failed";
}

export function createSandboxTestRunner(): TestRunner {
  return async (files, signal) => {
    const t0 = Date.now();
    const elapsed = () => Date.now() - t0;
    let sandbox: Sandbox | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const work = async (): Promise<TestReport> => {
      sandbox = await Sandbox.create({
        source: { type: "git", url: `https://github.com/${snapshot.repo}.git`, revision: snapshot.commit },
        runtime: "node24",
        timeout: TEST_TIMEOUT_MS + 30_000,
        persistent: false,
        signal,
      });

      const install = await sandbox.runCommand("npm", ["ci", "--no-audit", "--no-fund"], { signal });
      if (install.exitCode !== 0) {
        const out = (await install.stdout()) + (await install.stderr());
        return { ran: true, ok: false, summary: "npm install failed", output: tail(out), ms: elapsed() };
      }

      // Dependencies are in. From here nothing in the sandbox can reach the network.
      await sandbox.updateNetworkPolicy("deny-all", { signal });

      const entries = Object.entries(files).map(([path, content]) => ({ path, content: Buffer.from(content) }));
      if (entries.length) await sandbox.writeFiles(entries, { signal });

      const test = await sandbox.runCommand("npm", ["test"], { signal });
      const out = (await test.stdout()) + (await test.stderr());
      return { ran: true, ok: test.exitCode === 0, summary: summarizeTestOutput(out, test.exitCode), output: tail(out), ms: elapsed() };
    };

    try {
      const hard = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("The test run took too long.")), TEST_TIMEOUT_MS);
      });
      return await Promise.race([work(), hard]);
    } catch (err) {
      if (signal?.aborted) throw err;
      console.error("sandbox test run failed:", (err as Error).name, String((err as Error).message).slice(0, 200));
      return { ran: false, ok: false, summary: "Tests could not run (sandbox unavailable)", output: "", ms: elapsed() };
    } finally {
      clearTimeout(timer);
      await sandbox?.stop().catch(() => {});
    }
  };
}
