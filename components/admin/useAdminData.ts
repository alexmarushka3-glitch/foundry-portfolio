"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AdminAction } from "@/lib/admin/actions";
import type { AdminOverview } from "@/lib/admin/overview";

export type AdminData = {
  data: AdminOverview | null;
  error: string | null;
  loading: boolean;
  /** The action in flight, if any. */
  pending: AdminAction | null;
  refresh: () => Promise<void>;
  act: (action: AdminAction) => Promise<void>;
  /** Absent on the sample-data page, which has no session. */
  signOut?: () => Promise<void>;
};

/** Loads the overview, refreshes it on a timer, and runs the key actions. A 401 sends the user back to sign in. */
export function useAdminData(autoRefresh: boolean, intervalMs = 10_000): AdminData {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<AdminAction | null>(null);
  const alive = useRef(true);

  const request = useCallback(async (input: string, init?: RequestInit): Promise<AdminOverview | null> => {
    const res = await fetch(input, { cache: "no-store", ...init });
    if (res.status === 401) {
      window.location.reload(); // the session ended: the page will show the sign-in form
      return null;
    }
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? `Request failed (${res.status})`);
    }
    return (await res.json()) as AdminOverview;
  }, []);

  const refresh = useCallback(async () => {
    try {
      const next = await request("/api/admin/stats");
      if (!alive.current || !next) return;
      setData(next);
      setError(null);
    } catch (e) {
      if (alive.current) setError((e as Error).message);
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [request]);

  const act = useCallback(
    async (action: AdminAction) => {
      setPending(action);
      try {
        const next = await request("/api/admin/actions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        if (alive.current && next) {
          setData(next);
          setError(null);
        }
      } catch (e) {
        if (alive.current) setError((e as Error).message);
      } finally {
        if (alive.current) setPending(null);
      }
    },
    [request],
  );

  const signOut = useCallback(async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.reload();
  }, []);

  useEffect(() => {
    alive.current = true;
    void refresh();
    return () => {
      alive.current = false;
    };
  }, [refresh]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => void refresh(), intervalMs);
    return () => clearInterval(id);
  }, [autoRefresh, intervalMs, refresh]);

  return { data, error, loading, pending, refresh, act, signOut };
}
