"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

/** A playback clock for a finished run: play, pause, speed and seek. `t` is milliseconds on the run's timeline. */
export function usePlayback(total: number) {
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const tRef = useRef(0);
  tRef.current = t;

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const next = Math.min(total, tRef.current + (now - last) * speed);
      last = now;
      tRef.current = next;
      setT(next);
      if (next >= total) {
        setPlaying(false);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, total]);

  const seek = useCallback((v: number) => {
    tRef.current = v;
    setT(v);
  }, []);

  return { t, playing, speed, setPlaying, setSpeed, seek };
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const apply = () => setMatches(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [query]);
  return matches;
}

/** Asks the server whether requests built in the form can run live. Null until it answers. */
export function useLiveAvailability(): boolean | null {
  const [available, setAvailable] = useState<boolean | null>(null);
  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/run", { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d: { live?: boolean }) => setAvailable(Boolean(d.live)))
      .catch(() => {
        if (!ctrl.signal.aborted) setAvailable(false);
      });
    return () => ctrl.abort();
  }, []);
  return available;
}

/** Calls `onView` once, the first time the element fills enough of the screen. */
export function useOnceInView(ref: RefObject<HTMLElement | null>, onView: () => void, enabled: () => boolean) {
  const cb = useRef(onView);
  cb.current = onView;
  const gate = useRef(enabled);
  gate.current = enabled;
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || !gate.current()) return;
        // The stage can be taller than the screen, so judge by how much of the screen it fills.
        const fillsScreen = entry.intersectionRect.height >= window.innerHeight * 0.5;
        if (entry.intersectionRatio < 0.5 && !fillsScreen) return;
        io.disconnect();
        cb.current();
      },
      { threshold: [0, 0.1, 0.25, 0.5, 0.75] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
}
