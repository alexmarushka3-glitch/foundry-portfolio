"use client";

import { useState } from "react";

/** Takes one hosted app link down: paste the link, press Remove. Links also delete themselves after 7 days. */
export default function LinksPanel() {
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");

  async function remove(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setResult("");
    try {
      const res = await fetch("/api/admin/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ link }),
      });
      const body = (await res.json().catch(() => ({}))) as { removed?: boolean; error?: string };
      if (!res.ok) setResult(body.error ?? `Request failed (${res.status})`);
      else if (body.removed) {
        setResult("Removed. That link now shows “expired or never saved”.");
        setLink("");
      } else setResult("No saved app for that link. It may have expired or been removed already.");
    } catch {
      setResult("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card controls" aria-labelledby="links-title">
      <h2 id="links-title">App links</h2>
      <p className="fine">
        Paste a link to an app (https://…/a/…) to take it down now. They delete themselves after 7
        days.
      </p>
      <form className="actions" onSubmit={(e) => void remove(e)}>
        <label className="fine">
          Link to remove
          <input value={link} onChange={(e) => setLink(e.target.value)} autoComplete="off" />
        </label>
        <button type="submit" className="danger" disabled={busy || !link.trim()}>
          {busy ? "Removing…" : "Remove this link"}
        </button>
      </form>
      {result && (
        <p className="fine" role="status">
          {result}
        </p>
      )}
    </section>
  );
}
