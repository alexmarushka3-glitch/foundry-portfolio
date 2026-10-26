// Builds the sandbox snapshot the live runs start from: taskly-sample at the pinned commit, dependencies
// installed, and a headless Chromium with the system libraries it needs. Starting from it takes about a
// second instead of about 50. Run this again whenever taskly-sample changes (rebuild the repo copy first with
// scripts/build-snapshot.mjs) or when a run says the snapshot has expired (they last 30 days after last use).
//
//   npx.cmd vercel@latest env pull .env.sandbox.local --environment=development
//   npx.cmd tsx --env-file=.env.sandbox.local scripts/build-sandbox-snapshot.mjs
//
// It prints a snapshot id. Put it in the Vercel env var FOUNDRY_SANDBOX_SNAPSHOT (Production) and redeploy.
import { Sandbox } from "@vercel/sandbox";
import { readFileSync } from "node:fs";

const repo = JSON.parse(readFileSync(new URL("../lib/tasklySnapshot.json", import.meta.url), "utf8"));
const t0 = Date.now();
const lap = (l) => console.log(`${((Date.now() - t0) / 1000).toFixed(0)}s ${l}`);

const sandbox = await Sandbox.create({
  source: { type: "git", url: `https://github.com/${repo.repo}.git`, revision: repo.commit },
  runtime: "node24",
  timeout: 10 * 60_000,
});
lap("sandbox created");

const sh = async (label, cmd) => {
  const r = await sandbox.runCommand("bash", ["-lc", cmd]);
  lap(`${label}: exit ${r.exitCode}`);
  if (r.exitCode !== 0) {
    console.log(((await r.stdout()) + (await r.stderr())).split("\n").slice(-15).join("\n"));
    await sandbox.stop();
    process.exit(1);
  }
};

await sh("npm ci", "npm ci --no-audit --no-fund");
await sh("chromium", "npx playwright install chromium-headless-shell");
await sh(
  "system libraries",
  "sudo dnf install -y --setopt=install_weak_deps=False nss nspr atk at-spi2-atk cups-libs libdrm libxkbcommon libXcomposite libXdamage libXfixes libXrandr mesa-libgbm pango cairo alsa-lib libX11 libxcb",
);
await sh("browser check", "npx playwright test");

const snap = await sandbox.snapshot();
lap("snapshot taken");
console.log(`\nFOUNDRY_SANDBOX_SNAPSHOT=${snap.snapshotId}\ncommit ${repo.commit}`);
