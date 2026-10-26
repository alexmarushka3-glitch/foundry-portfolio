// Tries the real test runner end to end with a good file set and a broken one. Prints reports.
// Needs a VERCEL_OIDC_TOKEN (run: npx.cmd vercel env pull .env.sandbox.local --environment=development), then:
//   node --env-file=.env.sandbox.local --experimental-strip-types scripts/sandbox-smoke.mjs
// (the runner is TypeScript, so this script goes through tsx instead when strip-types cannot resolve the import)
import { createSandboxTestRunner } from "../lib/pipeline/sandbox.ts";

const run = createSandboxTestRunner();
const show = (label, r) => console.log(label, JSON.stringify({ ...r, output: r.output.split("\n").slice(-4).join(" | ") }, null, 1));

show("clean repo:", await run({}));
show("broken file:", await run({ "src/db.js": "export const nope = ;\n" }));
