"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PipelineSvg from "./PipelineSvg";
import { AGENT_BY_ID, AGENT_LIST } from "@/lib/agents";
import {
  EXAMPLE_REQUESTS,
  buildReplayRun,
  findRecording,
  formatClock,
  formatDuration,
  framesFrom,
  maxRound,
  viewsAt,
  type AgentFrame,
  type Run,
  type Step,
  type StepView,
} from "@/lib/run";
import type { AgentName, FoundryEvent, Mode } from "@/lib/types";

/* ---------- live (streamed) runs ---------- */

type LiveStep = StepView & { start: number; end?: number };
type Live = {
  request: string;
  mode: Mode | null;
  reason?: string;
  steps: LiveStep[];
  costUsd: number;
};

const MODE_COPY: Record<Mode, { label: string; detail: string }> = {
  replay: {
    label: "Replay of a real run",
    detail: "Genuine Claude output from a run I recorded, played back faster than it ran.",
  },
  live: {
    label: "Live",
    detail: "Real Claude models, answering now.",
  },
  simulated: {
    label: "Simulated",
    detail: "Scripted text. No model was called.",
  },
};

const idleFrames = (): AgentFrame[] => AGENT_LIST.map((a) => ({ agent: a.id, status: "pending", round: 0, text: "" }));

/* ---------- playback clock for finished runs ---------- */

function usePlayback(total: number) {
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

/* ---------- output panel ---------- */

function OutputPanel({ frame }: { frame: AgentFrame }) {
  const info = AGENT_BY_ID[frame.agent];
  const ref = useRef<HTMLPreElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el && frame.status === "active") el.scrollTop = el.scrollHeight;
  }, [frame.text, frame.status]);

  const state =
    frame.status === "pending"
      ? "Waiting its turn"
      : frame.status === "active"
        ? "Writing now"
        : frame.passed === false
          ? "Sent back"
          : frame.passed === true
            ? "Passed"
            : "Done";

  return (
    <article className={`panel ${frame.status}`}>
      <header>
        <h3>
          {info.label}
          {frame.round > 1 ? <span className="round"> round {frame.round}</span> : null}
        </h3>
        <p className="panel-meta">
          {state}
          {frame.model ? ` · ${frame.model}` : ""}
          {frame.ms !== undefined ? ` · ${formatDuration(frame.ms)}` : ""}
        </p>
      </header>
      <p className="panel-job">{info.job}</p>
      <pre ref={ref} tabIndex={0} aria-label={`${info.label} output`}>
        {frame.text}
        {frame.status === "active" && <span className="caret" aria-hidden="true" />}
        {frame.status === "pending" && <span className="muted">Nothing yet.</span>}
      </pre>
    </article>
  );
}

/* ---------- the stage ---------- */

export default function Stage() {
  const [input, setInput] = useState(EXAMPLE_REQUESTS[0] ?? "");
  const [run, setRun] = useState<Run | null>(null);
  const [live, setLive] = useState<Live | null>(null);
  const [selected, setSelected] = useState<AgentName | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [liveAvailable, setLiveAvailable] = useState<boolean | null>(null);
  const [narrow, setNarrow] = useState(false);

  const { t, playing, speed, setPlaying, setSpeed, seek } = usePlayback(run?.total ?? 0);
  const sectionRef = useRef<HTMLElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const touchedRef = useRef(false);
  const autoRef = useRef(false);

  /* layout, live availability */
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 760px)");
    const apply = () => setNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    fetch("/api/run")
      .then((r) => r.json())
      .then((d: { live?: boolean }) => setLiveAvailable(Boolean(d.live)))
      .catch(() => setLiveAvailable(false));
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  /* start a recorded replay in the browser: instant, free, and scrubbable */
  const startReplay = useCallback(
    (request: string) => {
      const rec = findRecording(request);
      if (!rec) return false;
      abortRef.current?.abort();
      const r = buildReplayRun(rec);
      setLive(null);
      setError(null);
      setSelected(null);
      setRun(r);
      seek(0);
      setPlaying(true);
      return true;
    },
    [seek, setPlaying],
  );

  /* a typed idea goes to the server: live if it's switched on, a simulation if not */
  const startRemote = useCallback(
    async (request: string) => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const t0 = performance.now();
      const now = () => performance.now() - t0;

      setRun(null);
      setPlaying(false);
      setSelected(null);
      setError(null);
      const state: Live = { request, mode: null, steps: [], costUsd: 0 };
      setLive({ ...state });

      let approved = false;
      let rounds = 1;
      let realMs = 0;
      let finished = false;

      const apply = (e: FoundryEvent) => {
        switch (e.type) {
          case "mode":
            state.mode = e.mode;
            state.reason = e.reason;
            break;
          case "start":
            state.steps = [...state.steps, { agent: e.agent, round: e.round, model: e.model, text: "", status: "active", start: now() }];
            break;
          case "token":
            state.steps = state.steps.map((s) => (s.agent === e.agent && s.round === e.round ? { ...s, text: s.text + e.text } : s));
            break;
          case "done":
            state.steps = state.steps.map((s) => (s.agent === e.agent && s.round === e.round ? { ...s, status: "done", ms: e.ms, end: now() } : s));
            break;
          case "usage":
            state.costUsd += e.costUsd;
            break;
          case "verdict":
            state.steps = state.steps.map((s) => (s.agent === e.gate && s.round === e.round ? { ...s, passed: e.approved } : s));
            break;
          case "finish":
            approved = e.approved;
            rounds = e.rounds;
            realMs = e.ms;
            finished = true;
            break;
          case "error":
            setError(e.message);
            break;
        }
        setLive({ ...state, steps: state.steps });
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
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (line) apply(JSON.parse(line) as FoundryEvent);
          }
        }
        if (finished) {
          // Turn the finished stream into a run you can scrub, using the times it really arrived.
          const steps: Step[] = state.steps.map((s) => ({
            agent: s.agent,
            round: s.round,
            model: s.model,
            text: s.text,
            start: s.start,
            end: s.end ?? now(),
            ms: s.ms ?? 0,
            passed: s.passed,
          }));
          const total = Math.max(...steps.map((s) => s.end)) + 700;
          setRun({
            request,
            mode: state.mode ?? "simulated",
            steps,
            total,
            approved,
            rounds,
            realMs,
            costUsd: state.mode === "live" ? state.costUsd : undefined,
          });
          setLive(null);
          seek(total);
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError((err as Error).message);
          setLive(null);
        }
      }
    },
    [seek, setPlaying],
  );

  const go = useCallback(
    (request: string) => {
      const q = request.trim();
      if (!q) return;
      touchedRef.current = true;
      if (!startReplay(q)) void startRemote(q);
    },
    [startReplay, startRemote],
  );

  /* one orchestrated moment: when the stage scrolls into view, the first example plays once */
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || autoRef.current || touchedRef.current) return;
        // The stage can be taller than the screen, so judge by how much of the screen it fills.
        const fillsScreen = entry.intersectionRect.height >= window.innerHeight * 0.5;
        if (entry.intersectionRatio < 0.5 && !fillsScreen) return;
        autoRef.current = true;
        const first = EXAMPLE_REQUESTS[0];
        if (!first) return;
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          const rec = findRecording(first);
          if (rec) {
            const r = buildReplayRun(rec);
            setRun(r);
            seek(r.total);
          }
        } else {
          startReplay(first);
        }
        io.disconnect();
      },
      { threshold: [0, 0.1, 0.25, 0.5, 0.75] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [seek, startReplay]);

  /* what to draw */
  const views: StepView[] = useMemo(() => {
    if (live) return live.steps;
    if (run) return viewsAt(run, t);
    return [];
  }, [live, run, t]);
  const frames = useMemo(() => (views.length ? framesFrom(views) : idleFrames()), [views]);
  const sentBack = maxRound(views) > 1;
  const mode: Mode | null = live ? live.mode : (run?.mode ?? null);
  const reason = live ? live.reason : undefined;
  const atEnd = run !== null && t >= run.total - 1;

  const byId = Object.fromEntries(frames.map((f) => [f.agent, f])) as Record<AgentName, AgentFrame>;
  const active = frames.filter((f) => f.status === "active");
  const lastDone = [...frames].reverse().find((f) => f.status === "done");
  const focus: AgentFrame[] = selected ? [byId[selected]] : active.length ? active : lastDone ? [lastDone] : [];

  const announce = active.length
    ? `${active.map((a) => AGENT_BY_ID[a.agent].label).join(" and ")} ${active.length > 1 ? "are" : "is"} working.`
    : atEnd
      ? "Run finished."
      : "";

  const busy = live !== null;

  const summary = (() => {
    if (!run || !atEnd) return null;
    const verdict = run.approved
      ? `Passed both checks in ${run.rounds} round${run.rounds > 1 ? "s" : ""}.`
      : "Stopped without passing both checks.";
    if (run.mode === "replay") return `${verdict} The real run took ${formatDuration(run.realMs)}.`;
    if (run.mode === "live") {
      const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 3, maximumFractionDigits: 3 });
      const cost = run.costUsd !== undefined ? ` Estimated cost: ${money.format(run.costUsd)}.` : "";
      return `${verdict} Took ${formatDuration(run.realMs)}.${cost}`;
    }
    return `${verdict} This was scripted text, so no model ran.`;
  })();

  const modeCopy = mode ? MODE_COPY[mode] : null;

  return (
    <section ref={sectionRef} className="stage" id="demo" aria-labelledby="stage-title">
      <div className="stage-head">
        <h2 id="stage-title">Watch eight agents build a feature</h2>
        {modeCopy && (
          <p className={`badge ${mode}`} role="status">
            <span className="dot" aria-hidden="true" />
            {modeCopy.label}
          </p>
        )}
      </div>

      <form
        className="idea"
        onSubmit={(e) => {
          e.preventDefault();
          go(input);
        }}
      >
        <label htmlFor="idea">A feature idea for a small task-tracker app</label>
        <div className="idea-row">
          <input
            id="idea"
            name="idea"
            autoComplete="off"
            value={input}
            maxLength={200}
            onChange={(e) => setInput(e.target.value)}
            placeholder="For example, add a due date to tasks…"
          />
          <button className="run" type="submit" disabled={busy || !input.trim()}>
            {busy ? "Running…" : "Run"}
          </button>
        </div>
        <div className="examples" role="group" aria-label="Recorded examples">
          {EXAMPLE_REQUESTS.map((ex) => (
            <button
              key={ex}
              type="button"
              className="example"
              disabled={busy}
              aria-pressed={run?.request === ex}
              onClick={() => {
                setInput(ex);
                go(ex);
              }}
            >
              {ex}
            </button>
          ))}
        </div>
        <p className="hint">
          {liveAvailable === null
            ? ""
            : liveAvailable
              ? "The examples replay real recorded runs. Any other idea runs live on real Claude models."
              : "The examples replay real recorded runs. Any other idea runs a labelled simulation."}
        </p>
      </form>

      <PipelineSvg frames={frames} layout={narrow ? "narrow" : "wide"} selected={selected} onSelect={(a) => setSelected((cur) => (cur === a ? null : a))} sentBack={sentBack} />

      <p className="sr-only" aria-live="polite">
        {announce}
      </p>

      {modeCopy && (
        <p className="mode-detail">
          {modeCopy.detail}
          {reason ? ` ${reason}` : ""}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <div className="panels">
        {focus.length === 0 ? (
          <p className="empty">Pick an idea above, or type your own. The agents will build it while you watch.</p>
        ) : (
          focus.map((f) => <OutputPanel key={f.agent} frame={f} />)
        )}
      </div>
      {selected && (
        <button className="follow" type="button" onClick={() => setSelected(null)}>
          Follow the action again
        </button>
      )}

      <div className="player">
        {run ? (
          <>
            <button
              type="button"
              className="play"
              onClick={() => {
                if (atEnd) seek(0);
                setPlaying(!playing || atEnd);
              }}
              aria-label={playing ? "Pause" : atEnd ? "Replay from the start" : "Play"}
            >
              {playing ? "Pause" : atEnd ? "Replay" : "Play"}
            </button>
            <div className="speeds" role="group" aria-label="Playback speed">
              {[1, 2, 4].map((s) => (
                <button key={s} type="button" aria-pressed={speed === s} onClick={() => setSpeed(s)}>
                  {s}x
                </button>
              ))}
            </div>
            <input
              className="scrub"
              type="range"
              min={0}
              max={Math.round(run.total)}
              value={Math.round(t)}
              aria-label="Scrub through the run"
              onChange={(e) => {
                setPlaying(false);
                seek(Number(e.target.value));
              }}
            />
            <span className="clock">
              {formatClock(t)} / {formatClock(run.total)}
            </span>
          </>
        ) : live ? (
          <p className="player-note">Running now. You can scrub back through it once it finishes.</p>
        ) : (
          <p className="player-note">Pick an idea to start.</p>
        )}
      </div>
      {summary && <p className="summary">{summary}</p>}
    </section>
  );
}
