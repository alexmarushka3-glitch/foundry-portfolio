"use client";

import type { KeyboardEvent } from "react";
import AgentIcon from "./AgentIcon";
import { AGENT_BY_ID } from "@/lib/agents";
import { formatDuration } from "@/lib/format";
import type { AgentFrame } from "@/lib/run";
import type { AgentName } from "@/lib/types";

type Layout = "wide" | "narrow";
type Pos = { x: number; y: number };

const GEOMETRY: Record<
  Layout,
  { viewBox: string; w: number; h: number; pos: Record<AgentName, Pos> }
> = {
  wide: {
    // tight to the boxes: the "sent back" arcs are drawn outside it (the svg lets them overflow into the margin)
    viewBox: "0 14 1000 222",
    w: 122,
    h: 84,
    pos: {
      researcher: { x: 65, y: 125 },
      story: { x: 200, y: 125 },
      pm: { x: 340, y: 125 },
      backend: { x: 490, y: 68 },
      frontend: { x: 490, y: 182 },
      e2e: { x: 640, y: 125 },
      validator: { x: 780, y: 125 },
      release: { x: 925, y: 125 },
    },
  },
  narrow: {
    // 300 wide so the 14px text shows at about 11px on a 320px phone
    viewBox: "0 0 300 540",
    w: 184,
    h: 58,
    pos: {
      researcher: { x: 150, y: 34 },
      story: { x: 150, y: 106 },
      pm: { x: 150, y: 178 },
      backend: { x: 76, y: 268 },
      frontend: { x: 224, y: 268 },
      e2e: { x: 150, y: 358 },
      validator: { x: 150, y: 430 },
      release: { x: 150, y: 502 },
    },
  },
};

/**
 * Box width. In the wide layout "Project Manager" needs a wider box than the rest, or its label
 * touches the edge. In the narrow layout the two side by side boxes are narrower than the rest,
 * because the icon sits left of the text there.
 */
function nodeWidth(layout: Layout, agent: AgentName): number {
  const g = GEOMETRY[layout];
  if (layout === "wide") return agent === "pm" ? g.w + 14 : g.w;
  return agent === "backend" || agent === "frontend" ? 140 : g.w;
}

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
    const x1 = p.x + nodeWidth(layout, a) / 2;
    const x2 = q.x - nodeWidth(layout, b) / 2;
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
    <svg
      className={layout === "narrow" ? "pipeline pipeline-narrow" : "pipeline"}
      viewBox={g.viewBox}
      role="group"
      aria-label="Pipeline of eight agents"
      preserveAspectRatio="xMidYMid meet"
    >
      {EDGES.map(([a, b]) => (
        <g key={`${a}-${b}`}>
          <path className="edge" d={edgePath(layout, a, b)} />
          <path
            className={`edge-fill${byId[a].status === "done" ? " on" : ""}`}
            d={edgePath(layout, a, b)}
          />
        </g>
      ))}

      {layout === "wide" && (
        <g className={`sendback${sentBack ? " on" : ""}`} aria-hidden={!sentBack}>
          <path d="M640 83 C640 -9 490 -21 490 26" />
          <path d="M780 167 C780 275 490 275 490 224" />
          <text x="620" y="-18">
            sent back for another round
          </text>
        </g>
      )}

      {frames.map((f) => {
        const p = g.pos[f.agent];
        const info = AGENT_BY_ID[f.agent];
        const failed = f.status === "done" && f.passed === false;
        const w = nodeWidth(layout, f.agent);
        // wide: icon on top, text under it; narrow: icon left, text beside it
        const iconSize = layout === "wide" ? 24 : 16;
        const textX = layout === "wide" ? 14 : 36;
        const labelY = layout === "wide" ? 58 : g.h / 2 - 4;
        const markPos = layout === "wide" ? `${w - 28} 14` : `${w - 26} 9`;
        return (
          <g
            key={f.agent}
            className={`node ${f.status}${failed ? " failed" : ""}${selected === f.agent ? " selected" : ""}`}
            transform={`translate(${p.x - w / 2} ${p.y - g.h / 2})`}
            role="button"
            tabIndex={0}
            aria-pressed={selected === f.agent}
            aria-label={`${info.label}: ${subtitle(f)}. Show its output.`}
            onClick={() => onSelect(f.agent)}
            onKeyDown={(e) => onKey(e, f.agent)}
          >
            <rect className="node-ring" x={-4} y={-4} width={w + 8} height={g.h + 8} rx={14} />
            <rect className="node-bg" width={w} height={g.h} rx={10} />
            <AgentIcon
              agent={f.agent}
              size={iconSize}
              x={12}
              y={layout === "wide" ? 10 : (g.h - iconSize) / 2}
            />
            <text className="node-label" x={textX} y={labelY}>
              {info.label}
            </text>
            <text className="node-sub" x={textX} y={labelY + 18}>
              {subtitle(f)}
              {f.round > 1 ? `, round ${f.round}` : ""}
            </text>
            {f.status === "done" && (
              <g className="node-mark" transform={`translate(${markPos})`}>
                {failed ? (
                  <path d="M3 3 L13 13 M13 3 L3 13" />
                ) : (
                  <path d="M2 8.5 L6.5 13 L14 3.5" />
                )}
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}
