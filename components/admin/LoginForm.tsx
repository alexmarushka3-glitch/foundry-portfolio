"use client";

import { useState } from "react";

/** Asks for the admin token. On success the server sets a session cookie and the page reloads into the dashboard. */
export default function LoginForm() {
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (res.ok) {
        window.location.reload();
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Could not sign in.");
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="admin login">
      <form className="card" onSubmit={submit}>
        <h1>Foundry admin</h1>
        <p className="muted">Enter the admin token to continue.</p>
        <label htmlFor="token">Admin token</label>
        <input id="token" type="password" autoComplete="current-password" value={token} onChange={(e) => setToken(e.target.value)} />
        {error && (
          <p className="banner error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="primary" disabled={busy || !token}>
          {busy ? "Checking…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
