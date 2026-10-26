import { Sandbox } from "@vercel/sandbox";
import snapshot from "../tasklySnapshot.json";

// Builds the sandbox snapshot that live runs start from (see sandbox.ts): taskly-sample at the pinned commit,
// dependencies installed, headless Chromium and the system libraries it needs. The admin dashboard calls this
// from inside the deployment, so the snapshot is made with that deployment's own sandbox credentials, which is
// the only kind a production run can see. The same steps live in scripts/build-sandbox-snapshot.mjs for local use.

export type SnapshotBuild = { snapshotId: string; commit: string; seconds: number; steps: string[] };

const LIBS =
  "sudo dnf install -y --setopt=install_weak_deps=False nss nspr atk at-spi2-atk cups-libs libdrm libxkbcommon libXcomposite libXdamage libXfixes libXrandr mesa-libgbm pango cairo alsa-lib libX11 libxcb";

let building: Promise<SnapshotBuild> | null = null;

/** True while a build is running, so a second click cannot start another. */
export const snapshotBuilding = () => building !== null;

export function buildSandboxSnapshot(): Promise<SnapshotBuild> {
  if (building) return building;
  building = run().finally(() => {
    building = null;
  });
  return building;
}

async function run(): Promise<SnapshotBuild> {
  const t0 = Date.now();
  const steps: string[] = [];
  const lap = (label: string) => steps.push(`${Math.round((Date.now() - t0) / 1000)}s ${label}`);

  const sandbox = await Sandbox.create({
    runtime: "node24",
    timeout: 5 * 60_000,
    source: { type: "git", url: `https://github.com/${snapshot.repo}.git`, revision: snapshot.commit },
  });
  lap("sandbox created");
  try {
    const sh = async (label: string, cmd: string) => {
      const r = await sandbox.runCommand("bash", ["-lc", `${cmd} 2>&1 | tail -c 1500; exit \${PIPESTATUS[0]}`]);
      lap(`${label}: exit ${r.exitCode}`);
      if (r.exitCode !== 0) throw new Error(`${label} failed: ${(await r.stdout()).slice(-300)}`);
    };
    await sh("npm ci", "npm ci --no-audit --no-fund");
    await sh("chromium", "npx playwright install chromium-headless-shell");
    await sh("system libraries", LIBS);
    await sh("browser check", "npx playwright test");
    const snap = await sandbox.snapshot();
    lap("snapshot taken");
    return { snapshotId: snap.snapshotId, commit: snapshot.commit, seconds: Math.round((Date.now() - t0) / 1000), steps };
  } catch (err) {
    await sandbox.stop().catch(() => {});
    throw err;
  }
}
