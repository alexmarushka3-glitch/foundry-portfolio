// Records real live runs (events with timings) into recordings-src/live/<slug>.json.
// Costs real money (about $0.18 to $0.31 a run), so it needs --confirm. No GitHub env is read, so no pull request is opened.
//
//   npx.cmd vite-node scripts/record-live-runs.ts -- --requests 4 --confirm
//
// Reads ANTHROPIC_API_KEY from .env.local and the sandbox login from .env.sandbox.local. Put
// FOUNDRY_SANDBOX_SNAPSHOT in .env.eval.local. All three are gitignored. It never prints a key.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { planBatch, UPPER_COST_PER_RUN_USD } from "../lib/eval/plan";
import { runPipeline } from "../lib/pipeline";
import { assertRecordingSize, captureRun } from "../lib/recorder/capture";

// Later files win. Passing --confirm is the decision to spend, so live runs are switched on here.
for (const file of [".env.local", ".env.sandbox.local", ".env.eval.local"]) {
  if (existsSync(file)) Object.assign(process.env, parseEnv(readFileSync(file, "utf8")));
}
// Recordings never open a pull request: drop any GitHub App settings the env files carry.
for (const key of Object.keys(process.env)) if (key.startsWith("GITHUB_APP_")) delete process.env[key];
process.env.FOUNDRY_LIVE = "on";

const OUT_DIR = "recordings-src/live";
const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const countArg = args[args.indexOf("--requests") + 1];

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

if (!process.env.ANTHROPIC_API_KEY) fail("ANTHROPIC_API_KEY is not set (expected in .env.local). Nothing was run.");
if (!process.env.FOUNDRY_SANDBOX_SNAPSHOT) {
  fail("FOUNDRY_SANDBOX_SNAPSHOT is not set (put it in .env.eval.local). Nothing was run.");
}

const plan = (() => {
  try {
    return planBatch(Number(countArg));
  } catch (err) {
    return fail(`${(err as Error).message} Use --requests <number>. Nothing was run.`);
  }
})();

console.log(`${plan.requests.length} live runs, at most about $${plan.maxCostUsd.toFixed(2)} ($${UPPER_COST_PER_RUN_USD} each, upper estimate; retries cost extra).`);
if (!flag("--confirm")) fail("Add --confirm to spend that. Nothing was run.");

mkdirSync(OUT_DIR, { recursive: true });

function slugFor(request: string, i: number): string {
  const words = request
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return `${String(i + 1).padStart(2, "0")}-${words || "run"}`;
}

let failures = 0;
for (const [i, request] of plan.requests.entries()) {
  const slug = slugFor(request, i);
  if (existsSync(`${OUT_DIR}/${slug}.json`)) {
    console.log(`${slug}: already recorded, skipping (delete the file by hand to re-record).`);
    continue;
  }
  let saved = false;
  for (let attempt = 1; attempt <= 2 && !saved; attempt++) {
    try {
      const rec = await captureRun(slug, request, (emit) => runPipeline(request, emit));
      const json = JSON.stringify(rec, null, 2) + "\n";
      assertRecordingSize(json);
      writeFileSync(`${OUT_DIR}/${slug}.json`, json);
      saved = true;
      console.log(`${slug}: ${rec.approved ? "approved" : "not approved"}, ${rec.rounds} round(s), $${rec.costUsd.toFixed(3)}, ${rec.totalMs} ms`);
    } catch (err) {
      const e = err as Error;
      console.error(`${slug}: attempt ${attempt} failed (${e.name}: ${String(e.message).slice(0, 200)})${attempt < 2 ? ", retrying once" : ""}`);
    }
  }
  if (!saved) failures++;
}

if (failures) fail(`${failures} request(s) were not recorded.`);
