"use client";

import { useEffect, useState } from "react";

type Build = { snapshotId: string; commit: string; seconds: number };

/** Builds the sandbox snapshot from inside production and shows its id, to paste into Vercel. */
export default function SandboxPanel() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [build, setBuild] = useState<Build | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/admin/snapshot")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { configured?: boolean } | null) => alive && setConfigured(d ? Boolean(d.configured) : null))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  async function run() {
    setBusy(true);
    setError(null);
    setBuild(null);
    try {
      const res = await fetch("/api/admin/snapshot", { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as Partial<Build> & { error?: string };
      if (!res.ok || !body.snapshotId) throw new Error(body.error ?? `Request failed (${res.status})`);
      setBuild(body as Build);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card controls" aria-labelledby="sandbox-title">
      <h2 id="sandbox-title">Sandbox browser</h2>
      <p className="fine">
        Live runs start from a prepared snapshot (the sample app, its packages and Chromium). It has to be built by this site itself
        to be visible to it. {configured === null ? "" : configured ? "A snapshot id is set." : "No snapshot id is set, so the real browser step is skipped."}
      </p>
      <div className="actions">
        <button type="button" disabled={busy} onClick={() => void run()}>
          {busy ? "Building (about a minute)…" : "Build a new snapshot"}
        </button>
      </div>
      {error && (
        <p className="fine" role="alert">
          {error}
        </p>
      )}
      {build && (
        <div role="status">
          <p className="fine">
            Built in {build.seconds}s from commit {build.commit.slice(0, 7)}. In Vercel, set <code>FOUNDRY_SANDBOX_SNAPSHOT</code> (Production) to:
          </p>
          <p>
            <code>{build.snapshotId}</code>{" "}
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(build.snapshotId).then(() => setCopied(true)).catch(() => {});
              }}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </p>
          <p className="fine">Then redeploy, so the new value is picked up.</p>
        </div>
      )}
    </section>
  );
}
