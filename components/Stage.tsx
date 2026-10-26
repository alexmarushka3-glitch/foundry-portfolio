"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import IdeaForm from "./stage/IdeaForm";
import type { FeatureSpec } from "@/lib/spec";
import OutputPanel from "./stage/OutputPanel";
import PlayerControls from "./stage/PlayerControls";
import { useLiveAvailability, useMediaQuery, useOnceInView, usePlayback } from "./stage/hooks";
import { useLiveRun } from "./stage/useLiveRun";
import PipelineSvg from "./PipelineSvg";
import { AGENT_BY_ID } from "@/lib/agents";
import { EXAMPLE_REQUESTS, buildReplayRun, findRecording, framesFrom, maxRound, viewsAt, type AgentFrame, type Run, type StepView } from "@/lib/run";
import { profile } from "@/lib/profile";
import { runSummary } from "@/lib/summary";
import type { AgentName, Mode } from "@/lib/types";

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

/**
 * The live agent view. A recorded example replays in the browser (free, scrubbable); any other idea is sent
 * to the server and streamed back; a finished run, from either source, can be paused, sped up and scrubbed.
 */
export default function Stage() {
  const [run, setRun] = useState<Run | null>(null);
  const [selected, setSelected] = useState<AgentName | null>(null);

  const narrow = useMediaQuery("(max-width: 760px)");
  const liveAvailable = useLiveAvailability();
  const { t, playing, speed, setPlaying, setSpeed, seek } = usePlayback(run?.total ?? 0);

  const sectionRef = useRef<HTMLElement>(null);
  const touchedRef = useRef(false);

  const showFinished = useCallback(
    (finished: Run) => {
      setRun(finished);
      seek(finished.total);
    },
    [seek],
  );
  const { live, error, start: startLive, cancel: cancelLive, clearError } = useLiveRun(showFinished);
  const busy = live !== null;

  const resetView = useCallback(() => {
    setSelected(null);
    clearError();
  }, [clearError]);

  /** Play a recorded example in the browser. Returns false if the request isn't a recorded one. */
  const startReplay = useCallback(
    (request: string) => {
      const rec = findRecording(request);
      if (!rec) return false;
      cancelLive();
      resetView();
      setRun(buildReplayRun(rec));
      seek(0);
      setPlaying(true);
      return true;
    },
    [cancelLive, resetView, seek, setPlaying],
  );

  const go = useCallback(
    (request: string, spec?: FeatureSpec) => {
      const q = request.trim();
      if (!q || busy) return;
      touchedRef.current = true;
      if (!spec && startReplay(q)) return;
      setRun(null);
      setPlaying(false);
      resetView();
      void startLive(q, spec);
    },
    [busy, resetView, setPlaying, startLive, startReplay],
  );

  /* One orchestrated moment: when the stage scrolls into view, the first example plays once. */
  useOnceInView(
    sectionRef,
    () => {
      const first = EXAMPLE_REQUESTS[0];
      if (!first) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        const rec = findRecording(first);
        if (rec) showFinished(buildReplayRun(rec));
      } else {
        startReplay(first);
      }
    },
    () => !touchedRef.current,
  );

  /* What to draw. */
  const views: StepView[] = useMemo(() => (live ? live.steps : run ? viewsAt(run, t) : []), [live, run, t]);
  const frames = useMemo(() => framesFrom(views), [views]);
  const mode: Mode | null = live ? live.mode : (run?.mode ?? null);
  const modeCopy = mode ? MODE_COPY[mode] : null;
  const reason = live?.reason;
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

      <IdeaForm onSubmit={go} busy={busy} activeExample={run?.request} liveAvailable={liveAvailable} />

      <PipelineSvg
        frames={frames}
        layout={narrow ? "narrow" : "wide"}
        selected={selected}
        onSelect={(a) => setSelected((cur) => (cur === a ? null : a))}
        sentBack={maxRound(views) > 1}
      />
      <p className="pipeline-note">{profile.how}</p>

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
          <p className="empty">Pick an example above, or build your own request. The agents will build it while you watch.</p>
        ) : (
          focus.map((f) => <OutputPanel key={f.agent} frame={f} />)
        )}
      </div>
      {selected && (
        <button className="follow" type="button" onClick={() => setSelected(null)}>
          Follow the action again
        </button>
      )}

      <PlayerControls
        total={run ? run.total : null}
        t={t}
        playing={playing}
        speed={speed}
        running={busy}
        onTogglePlay={() => {
          if (atEnd) seek(0);
          setPlaying(!playing || atEnd);
        }}
        onSpeed={setSpeed}
        onSeek={(v) => {
          setPlaying(false);
          seek(v);
        }}
      />
      {run && atEnd && (
        <div className="summary">
          <p>{runSummary(run)}</p>
          {run.pr && (
            <div className="summary-pr">
              <a className="btn btn-primary" href={run.pr.url} target="_blank" rel="noreferrer">
                See the draft pull request on GitHub (#{run.pr.number})
              </a>
              <p className="fine">It is a draft on a throwaway sample app, and no human has reviewed it.</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
