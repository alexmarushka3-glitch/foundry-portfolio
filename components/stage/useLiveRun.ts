"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { applyEvent, startLive, toRun, type LiveState } from "@/lib/liveRun";
import { readEvents } from "@/lib/ndjson";
import type { Run } from "@/lib/run";

/**
 * Starts a typed idea on the server and follows its stream. While it runs, `live` holds the steps so far
 * (updates are batched to one render per frame, since tokens arrive far faster than that). When it ends,
 * `onComplete` gets a finished run that can be scrubbed.
 */
export function useLiveRun(onComplete: (run: Run) => void) {
  const [live, setLive] = useState<LiveState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setLive(null);
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  const start = useCallback(async (request: string) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const t0 = performance.now();
    const now = () => performance.now() - t0;

    let state = startLive(request);
    setLive(state);
    setError(null);

    let frame = 0;
    const flush = () => {
      frame = 0;
      if (!ctrl.signal.aborted) setLive(state);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(flush);
    };

    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      await readEvents(res.body, (e) => {
        state = applyEvent(state, e, now());
        schedule();
      });
      if (ctrl.signal.aborted) return;

      const run = toRun(state, now());
      setLive(null);
      if (run) completeRef.current(run);
      // The stream ended without a finish event: an error from the server, or a dropped connection.
      else setError(state.error ?? "The run ended before it finished. Try again.");
    } catch (err) {
      if (ctrl.signal.aborted) return;
      setLive(null);
      setError((err as Error).message);
    } finally {
      if (frame) cancelAnimationFrame(frame);
      if (abortRef.current === ctrl) abortRef.current = null;
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { live, error, start, cancel, clearError };
}
