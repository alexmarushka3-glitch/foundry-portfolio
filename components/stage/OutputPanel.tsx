"use client";

import { useEffect, useRef } from "react";
import { AGENT_BY_ID } from "@/lib/agents";
import { formatDuration } from "@/lib/format";
import type { AgentFrame } from "@/lib/run";

function stateLabel(frame: AgentFrame): string {
  if (frame.status === "pending") return "Waiting its turn";
  if (frame.status === "active") return "Writing now";
  if (frame.passed === false) return "Sent back";
  if (frame.passed === true) return "Passed";
  return "Done";
}

/** One agent's output, with its state, model and timing. Follows the text while the agent is writing. */
export default function OutputPanel({ frame }: { frame: AgentFrame }) {
  const info = AGENT_BY_ID[frame.agent];
  const ref = useRef<HTMLPreElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el && frame.status === "active") el.scrollTop = el.scrollHeight;
  }, [frame.text, frame.status]);

  return (
    <article className={`panel ${frame.status}`}>
      <header>
        <h3>
          {info.label}
          {frame.round > 1 ? <span className="round"> round {frame.round}</span> : null}
        </h3>
        <p className="panel-meta">
          {stateLabel(frame)}
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
      {frame.shots && frame.shots.length > 0 && (
        <div className="shots" aria-label="Pictures from the real browser">
          {frame.shots.map((s, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <figure key={i}>
              <img src={`data:image/png;base64,${s.png}`} alt={s.label} loading="lazy" />
              <figcaption>{s.label}</figcaption>
            </figure>
          ))}
        </div>
      )}
    </article>
  );
}
