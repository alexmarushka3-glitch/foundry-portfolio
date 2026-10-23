// Assembles recordings-src/ (raw agent outputs from a real run) into lib/recordings.json.
// Run: node scripts/build-recordings.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "recordings-src");
const meta = JSON.parse(readFileSync(join(src, "meta.json"), "utf8"));

const ORDER = ["researcher", "story", "pm", "backend", "frontend", "e2e", "validator", "release"];

const examples = meta.examples.map((ex) => {
  const steps = ORDER.map((agent, i) => ({
    agent,
    round: 1,
    model: meta.models[agent],
    ms: ex.ms[agent],
    text: readFileSync(join(src, ex.slug, `${i + 1}-${agent}.txt`), "utf8").trim(),
  }));
  const byAgent = Object.fromEntries(steps.map((s) => [s.agent, s]));
  const e2eOk = /^E2E:\s*PASS/i.test(byAgent.e2e.text);
  const approved = /^VERDICT:\s*APPROVE/i.test(byAgent.validator.text);
  // Backend and frontend ran in parallel, so the wall clock takes the slower of the two.
  const totalMs =
    ex.ms.researcher + ex.ms.story + ex.ms.pm + Math.max(ex.ms.backend, ex.ms.frontend) +
    ex.ms.e2e + ex.ms.validator + ex.ms.release;
  return { request: ex.request, steps, e2eOk, approved, rounds: 1, totalMs };
});

writeFileSync(join(root, "lib", "recordings.json"), JSON.stringify({ examples }, null, 2) + "\n");
for (const e of examples) console.log(e.request, "| e2e", e.e2eOk, "| approved", e.approved, "| total", e.totalMs, "ms");
