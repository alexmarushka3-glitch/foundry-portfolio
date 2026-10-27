// Runs the real pipeline on a fixed set of requests and records the outcomes in lib/eval/results.json.
// Costs real money (about $0.18 to $0.31 a run), so it needs --confirm. See docs/ARCHITECTURE.md.
//
//   npx.cmd vite-node scripts/run-eval.ts -- --runs 8 --confirm
//
// Reads ANTHROPIC_API_KEY from .env.local and the sandbox login from .env.sandbox.local. Put
// FOUNDRY_SANDBOX_SNAPSHOT in .env.eval.local. All three are gitignored. It never prints a key.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { collectRun } from "../lib/eval/collect";
import { planBatch, UPPER_COST_PER_RUN_USD } from "../lib/eval/plan";
import { summarizeRuns } from "../lib/eval/summarize";
import { runPipeline } from "../lib/pipeline";
import type { FoundryEvent } from "../lib/types";

// Later files win. vite-node has already loaded .env.development.local, which keeps live runs off for
// local dev, so this script turns them on itself: passing --confirm is the decision to spend.
for (const file of [".env.local", ".env.sandbox.local", ".env.eval.local"]) {
  if (existsSync(file)) Object.assign(process.env, parseEnv(readFileSync(file, "utf8")));
}
process.env.FOUNDRY_LIVE = "on";

const RESULTS = "lib/eval/results.json";
const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const runsArg = args[args.indexOf("--runs") + 1];

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

if (!process.env.ANTHROPIC_API_KEY) fail("ANTHROPIC_API_KEY is not set (expected in .env.local). Nothing was run.");
if (!process.env.FOUNDRY_SANDBOX_SNAPSHOT) {
  fail(
    "FOUNDRY_SANDBOX_SNAPSHOT is not set (put it in .env.eval.local). Without it the real tests and browser do not run,\n" +
      "and the success rate would not match the live site. Nothing was run.",
  );
}

const plan = (() => {
  try {
    return planBatch(Number(runsArg));
  } catch (err) {
    return fail(`${(err as Error).message} Use --runs <number>. Nothing was run.`);
  }
})();

console.log(`${plan.requests.length} live runs, at most about $${plan.maxCostUsd.toFixed(2)} ($${UPPER_COST_PER_RUN_USD} each, upper estimate).`);
if (!flag("--confirm")) fail("Add --confirm to spend that. Nothing was run.");

type Stored = { at: string; request: string; approved: boolean; rounds: number; costUsd: number; ms: number };
const stored: { runs: Stored[] } = JSON.parse(readFileSync(RESULTS, "utf8"));

let skipped = 0;
let errors = 0;
for (const [i, request] of plan.requests.entries()) {
  const events: FoundryEvent[] = [];
  try {
    await runPipeline(request, (e) => events.push(e));
  } catch (err) {
    errors++;
    console.error(`run ${i + 1}: failed (${(err as Error).name})`);
    if (errors >= 3) fail("Three runs failed, stopping to avoid wasted spend.");
    continue;
  }
  const run = collectRun(events);
  if (!run) {
    skipped++;
    console.log(`run ${i + 1}: not counted (not a finished live run)`);
    continue;
  }
  stored.runs.push({ at: new Date().toISOString(), request, ...run });
  writeFileSync(RESULTS, JSON.stringify(stored, null, 2) + "\n");
  console.log(`run ${i + 1}: ${run.approved ? "approved" : "not approved"}, ${run.rounds} round(s), $${run.costUsd.toFixed(3)}, ${Math.round(run.ms / 1000)}s`);
}

const s = summarizeRuns(stored.runs);
console.log(`\nAll recorded runs: ${s.approved} of ${s.total} approved (95% interval ${Math.round((s.low ?? 0) * 100)}% to ${Math.round((s.high ?? 0) * 100)}%).`);
if (skipped) console.log(`${skipped} run(s) were not counted.`);
