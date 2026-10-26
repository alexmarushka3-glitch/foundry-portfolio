// Probe: can a Vercel Sandbox run a real browser? Prints timings and what is installed.
//   node --env-file=.env.sandbox.local scripts/sandbox-browser-probe.mjs
import { Sandbox } from "@vercel/sandbox";

const t0 = Date.now();
const lap = (l) => console.log(`${((Date.now() - t0) / 1000).toFixed(1)}s ${l}`);
const sandbox = await Sandbox.create({
  source: { type: "git", url: "https://github.com/alexmarushka3-glitch/taskly-sample.git" },
  runtime: "node24",
  timeout: 5 * 60_000,
  persistent: false,
});
lap("created");
const sh = async (label, cmd) => {
  const r = await sandbox.runCommand("bash", ["-lc", cmd]);
  const out = ((await r.stdout()) + (await r.stderr())).trim().split("\n").slice(-8).join("\n");
  lap(`${label}: exit ${r.exitCode}`);
  if (out) console.log(out);
  return r;
};
try {
  await sh("npm ci", "npm ci --no-audit --no-fund 2>&1 | tail -2");
  await sh("playwright install chromium (browser only)", "npx playwright install chromium-headless-shell 2>&1 | tail -1");
  await sh("dnf libs", "sudo dnf install -y --setopt=install_weak_deps=False nss nspr atk at-spi2-atk cups-libs libdrm libxkbcommon libXcomposite libXdamage libXfixes libXrandr mesa-libgbm pango cairo alsa-lib libX11 libxcb 2>&1 | tail -4");
  await sh("missing libs", "ldd ~/.cache/ms-playwright/chromium_headless_shell-*/chrome-*/headless_shell 2>&1 | grep 'not found' | head; echo checked");
  await sh("e2e smoke", "npx playwright test 2>&1 | tail -12");
} finally {
  const s = await sandbox.stop();
  lap(`stopped, cpu ${(s.activeCpuDurationMs / 1000).toFixed(1)}s, egress ${s.networkTransfer?.egress}, ingress ${s.networkTransfer?.ingress}`);
}
