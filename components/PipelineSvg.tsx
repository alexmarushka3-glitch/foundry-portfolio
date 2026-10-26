"use client";

import type { KeyboardEvent } from "react";
import { AGENT_BY_ID } from "@/lib/agents";
import { formatDuration } from "@/lib/format";
import type { AgentFrame } from "@/lib/run";
import type { AgentName } from "@/lib/types";

type Layout = "wide" | "narrow";
type Pos = { x: number; y: number };

const GEOMETRY: Record<Layout, { viewBox: string; w: number; h: number; pos: Record<AgentName, Pos> }> = {
  wide: {
    // tight to the boxes: the "sent back" arcs are drawn outside it (the svg lets them overflow into the margin)
    viewBox: "0 30 1000 190",
    w: 122,
    h: 58,
    pos: {
      researcher: { x: 70, y: 125 },
      story: { x: 205, y: 125 },
      pm: { x: 340, y: 125 },
      backend: { x: 490, y: 68 },
      frontend: { x: 490, y: 182 },
      e2e: { x: 640, y: 125 },
      validator: { x: 780, y: 125 },
      release: { x: 925, y: 125 },
    },
  },
  narrow: {
    viewBox: "0 0 340 540",
    w: 138,
    h: 54,
    pos: {
      researcher: { x: 170, y: 34 },
      story: { x: 170, y: 106 },
      pm: { x: 170, y: 178 },
      backend: { x: 92, y: 268 },
      frontend: { x: 248, y: 268 },
      e2e: { x: 170, y: 358 },
      validator: { x: 170, y: 430 },
      release: { x: 170, y: 502 },
    },
  },
};

const EDGES: [AgentName, AgentName][] = [
  ["researcher", "story"],
  ["story", "pm"],
  ["pm", "backend"],
  ["pm", "frontend"],
  ["backend", "e2e"],
  ["frontend", "e2e"],
  ["e2e", "validator"],
  ["validator", "release"],
];

function edgePath(layout: Layout, a: AgentName, b: AgentName): string {
  const g = GEOMETRY[layout];
  const p = g.pos[a];
  const q = g.pos[b];
  if (layout === "wide") {
    const x1 = p.x + g.w / 2;
    const x2 = q.x - g.w / 2;
    const xm = (x1 + x2) / 2;
    return `M${x1} ${p.y} C${xm} ${p.y} ${xm} ${q.y} ${x2} ${q.y}`;
  }
  const y1 = p.y + g.h / 2;
  const y2 = q.y - g.h / 2;
  const ym = (y1 + y2) / 2;
  return `M${p.x} ${y1} C${p.x} ${ym} ${q.x} ${ym} ${q.x} ${y2}`;
}

function subtitle(f: AgentFrame): string {
  if (f.status === "pending") return "waiting";
  if (f.status === "active") return "working";
  if (f.passed === false) return "sent back";
  if (f.passed === true) return "passed";
  return f.ms !== undefined ? formatDuration(f.ms) : "done";
}

export default function PipelineSvg({
  frames,
  layout,
  selected,
  onSelect,
  sentBack,
}: {
  frames: AgentFrame[];
  layout: Layout;
  selected: AgentName | null;
  onSelect: (a: AgentName) => void;
  sentBack: boolean;
}) {
  const g = GEOMETRY[layout];
  const byId = Object.fromEntries(frames.map((f) => [f.agent, f])) as Record<AgentName, AgentFrame>;

  const onKey = (e: KeyboardEvent<SVGGElement>, id: AgentName) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(id);
    }
  };

  return (
    <svg className="pipeline" viewBox={g.viewBox} role="group" aria-label="Pipeline of eight agents" preserveAspectRatio="xMidYMid meet">
      {EDGES.map(([a, b]) => (
        <g key={`${a}-${b}`}>
          <path className="edge" d={edgePath(layout, a, b)} />
          <path className={`edge-fill${byId[a].status === "done" ? " on" : ""}`} d={edgePath(layout, a, b)} />
        </g>
      ))}

      {layout === "wide" && (
        <g className={`sendback${sentBack ? " on" : ""}`} aria-hidden={!sentBack}>
          <path d="M640 96 C640 4 490 -8 490 37" />
          <path d="M780 154 C780 262 490 262 490 211" />
          <text x="620" y="-6">sent back for another round</text>
        </g>
      )}

      {frames.map((f) => {
        const p = g.pos[f.agent];
        const info = AGENT_BY_ID[f.agent];
        const failed = f.status === "done" && f.passed === false;
        return (
          <g
            key={f.agent}
            className={`node ${f.status}${failed ? " failed" : ""}${selected === f.agent ? " selected" : ""}`}
            transform={`translate(${p.x - g.w / 2} ${p.y - g.h / 2})`}
            role="button"
            tabIndex={0}
            aria-pressed={selected === f.agent}
            aria-label={`${info.label}: ${subtitle(f)}. Show its output.`}
            onClick={() => onSelect(f.agent)}
            onKeyDown={(e) => onKey(e, f.agent)}
          >
            <rect className="node-ring" x={-4} y={-4} width={g.w + 8} height={g.h + 8} rx={14} />
            <rect className="node-bg" width={g.w} height={g.h} rx={10} />
            <text className="node-label" x={14} y={g.h / 2 - 3}>
              {info.label}
            </text>
            <text className="node-sub" x={14} y={g.h / 2 + 15}>
              {subtitle(f)}
              {f.round > 1 ? `, round ${f.round}` : ""}
            </text>
            {f.status === "done" && (
              <g className="node-mark" transform={`translate(${g.w - 25} ${g.h - 27})`}>
                {failed ? <path d="M3 3 L13 13 M13 3 L3 13" /> : <path d="M2 8.5 L6.5 13 L14 3.5" />}
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}
