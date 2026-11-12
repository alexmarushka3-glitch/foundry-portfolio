import AgentIcon from "./AgentIcon";
import { profile } from "@/lib/profile";
import type { AgentName } from "@/lib/types";

/**
 * "How it works": one still diagram for the case study, idea -> eight agents -> app. Designed in the
 * "Foundry: agent icons" Figma file (frame "How it works"). Two drawings, one per width (the wide one
 * would be unreadably small on a phone); `.hiw-wide` and `.hiw-narrow` in globals.css show one of them.
 * Nothing in it moves. Groups follow the case study: one reads, two plan, two build, two check, one writes up.
 */

type Box = {
  id: string;
  label: string;
  sub?: string;
  agent?: AgentName;
  x: number;
  y: number;
  w: number;
  h: number;
  tone?: "idea" | "app";
};

const arrowRight = (x: number, y: number) => `M${x - 6} ${y - 5} L${x} ${y} L${x - 6} ${y + 5}`;
const arrowDown = (x: number, y: number) => `M${x - 5} ${y - 6} L${x} ${y} L${x + 5} ${y - 6}`;

function Node({ box, narrow }: { box: Box; narrow: boolean }) {
  const { x, y, w, h } = box;
  const iconSize = narrow ? 16 : 24;
  const plain = !box.agent; // idea and app: two lines of text, no icon
  const textX = narrow ? (plain ? 12 : 34) : plain ? 14 : 14;
  const labelY = plain ? (narrow ? 23 : 30) : narrow ? h / 2 + 5 : 53;
  return (
    <g className={`hiw-node${box.tone ? ` ${box.tone}` : ""}`} transform={`translate(${x} ${y})`}>
      <rect className="hiw-box" width={w} height={h} rx={10} />
      {box.agent && (
        <AgentIcon
          agent={box.agent}
          size={iconSize}
          x={narrow ? 10 : 12}
          y={narrow ? (h - iconSize) / 2 : 10}
        />
      )}
      <text className="hiw-label" x={textX} y={labelY}>
        {box.label}
      </text>
      {box.sub && (
        <text className="hiw-sub" x={textX} y={labelY + (narrow ? 18 : 18)}>
          {box.sub}
        </text>
      )}
    </g>
  );
}

// ---------- wide (1040 x 340): five columns of the Figma frame ----------
const W_NODE = { w: 140, h: 64 };
const wide: Box[] = [
  {
    id: "idea",
    label: "Your idea",
    sub: "one short request",
    x: 0,
    y: 128,
    ...W_NODE,
    tone: "idea",
  },
  { id: "researcher", label: "Researcher", agent: "researcher", x: 180, y: 44, ...W_NODE },
  { id: "story", label: "Story Writer", agent: "story", x: 180, y: 128, ...W_NODE },
  { id: "pm", label: "Project Manager", agent: "pm", x: 180, y: 212, ...W_NODE },
  { id: "backend", label: "Logic", agent: "backend", x: 360, y: 86, ...W_NODE },
  { id: "frontend", label: "Interface", agent: "frontend", x: 360, y: 170, ...W_NODE },
  { id: "e2e", label: "Browser Tester", agent: "e2e", x: 540, y: 86, ...W_NODE },
  { id: "validator", label: "Validator", agent: "validator", x: 540, y: 170, ...W_NODE },
  { id: "release", label: "Release", agent: "release", x: 720, y: 128, ...W_NODE },
  { id: "app", label: "Your app", sub: "one .html file", x: 900, y: 128, ...W_NODE, tone: "app" },
];
const WIDE_PHASES: [number, string][] = [
  [1, "Read and plan"],
  [2, "Build"],
  [3, "Check"],
  [4, "Write up"],
];
const WIDE_EDGES: [string, string][] = [
  ["idea", "researcher"],
  ["pm", "backend"],
  ["pm", "frontend"],
  ["backend", "e2e"],
  ["frontend", "e2e"],
  ["validator", "release"],
  ["release", "app"],
];
const WIDE_DOWN: [string, string][] = [
  ["researcher", "story"],
  ["story", "pm"],
  ["e2e", "validator"],
];

function wideEdge(by: Record<string, Box>, a: string, b: string): string {
  const p = by[a];
  const q = by[b];
  const x1 = p.x + p.w;
  const y1 = p.y + p.h / 2;
  const x2 = q.x;
  const y2 = q.y + q.h / 2;
  const xm = (x1 + x2) / 2;
  return `M${x1} ${y1} C${xm} ${y1} ${xm} ${y2} ${x2} ${y2} ${arrowRight(x2, y2)}`;
}

function WideDrawing({ label }: { label: string }) {
  const by = Object.fromEntries(wide.map((b) => [b.id, b]));
  // brackets under the Check and Build columns, and the loop between them
  const brY = 246;
  const ly = 298;
  const build = by.backend.x;
  const check = by.e2e.x;
  const bx = build + 70;
  const vx = check + 70;
  const loop =
    `M${check} ${brY - 6} L${check} ${brY} L${check + 140} ${brY} L${check + 140} ${brY - 6} ` +
    `M${build} ${brY - 6} L${build} ${brY} L${build + 140} ${brY} L${build + 140} ${brY - 6} ` +
    `M${vx} ${brY} L${vx} ${ly - 16} Q${vx} ${ly} ${vx - 16} ${ly} L${bx + 16} ${ly} Q${bx} ${ly} ${bx} ${ly - 16} L${bx} ${brY + 3} ` +
    `M${bx - 5} ${brY + 10} L${bx} ${brY + 3} L${bx + 5} ${brY + 10}`;
  return (
    <svg
      className="hiw-svg hiw-wide"
      viewBox="0 0 1040 340"
      role="img"
      aria-label={label}
      preserveAspectRatio="xMidYMid meet"
    >
      {WIDE_PHASES.map(([col, name]) => (
        <text key={name} className="hiw-phase" x={col * 180 + 70} y={16} textAnchor="middle">
          {name}
        </text>
      ))}
      {WIDE_EDGES.map(([a, b]) => (
        <path key={`${a}-${b}`} className="hiw-edge" d={wideEdge(by, a, b)} />
      ))}
      {WIDE_DOWN.map(([a, b]) => {
        const x = by[a].x + 70;
        const y1 = by[a].y + by[a].h;
        const y2 = by[b].y;
        return (
          <path
            key={`${a}-${b}`}
            className="hiw-edge"
            d={`M${x} ${y1} L${x} ${y2} ${arrowDown(x, y2)}`}
          />
        );
      })}
      <path className="hiw-loop" d={loop} />
      <text className="hiw-loop-label" x={(bx + vx) / 2} y={ly + 24} textAnchor="middle">
        Sent back for another round
      </text>
      {wide.map((b) => (
        <Node key={b.id} box={b} narrow={false} />
      ))}
    </svg>
  );
}

// ---------- narrow (300 x 746): the same story top to bottom, each group in an outlined box ----------
const N_AGENT = { w: 200, h: 46 };
const NX = 38; // stacked nodes: 138 (box centre) - 100
const narrow: Box[] = [
  {
    id: "idea",
    label: "Your idea",
    sub: "one short request",
    x: NX,
    y: 0,
    w: 200,
    h: 54,
    tone: "idea",
  },
  { id: "researcher", label: "Researcher", agent: "researcher", x: NX, y: 106, ...N_AGENT },
  { id: "story", label: "Story Writer", agent: "story", x: NX, y: 166, ...N_AGENT },
  { id: "pm", label: "Project Manager", agent: "pm", x: NX, y: 226, ...N_AGENT },
  { id: "backend", label: "Logic", agent: "backend", x: 16, y: 336, w: 118, h: 46 },
  { id: "frontend", label: "Interface", agent: "frontend", x: 142, y: 336, w: 118, h: 46 },
  { id: "e2e", label: "Browser Tester", agent: "e2e", x: NX, y: 446, ...N_AGENT },
  { id: "validator", label: "Validator", agent: "validator", x: NX, y: 506, ...N_AGENT },
  { id: "release", label: "Release", agent: "release", x: NX, y: 616, ...N_AGENT },
  {
    id: "app",
    label: "Your app",
    sub: "one .html file",
    x: NX,
    y: 692,
    w: 200,
    h: 54,
    tone: "app",
  },
];
const GROUPS: { name: string; y: number; h: number }[] = [
  { name: "Read and plan", y: 72, h: 212 },
  { name: "Build", y: 302, h: 92 },
  { name: "Check", y: 412, h: 152 },
  { name: "Write up", y: 582, h: 92 },
];
// vertical arrows on the centre line (138) between blocks, and inside the stacked groups
const NARROW_DOWN: [number, number][] = [
  [54, 72],
  [284, 302],
  [394, 412],
  [564, 582],
  [674, 692],
  [152, 166],
  [212, 226],
  [492, 506],
];

function NarrowDrawing({ label }: { label: string }) {
  const lane = 278;
  const yCheck = 412 + 76; // right edge, middle of the Check box
  const yBuild = 302 + 46; // right edge, middle of the Build box
  const loop =
    `M268 ${yCheck} L272 ${yCheck} Q${lane} ${yCheck} ${lane} ${yCheck - 6} L${lane} ${yBuild + 6} Q${lane} ${yBuild} 272 ${yBuild} L270 ${yBuild} ` +
    `M274 ${yBuild - 5} L268 ${yBuild} L274 ${yBuild + 5}`;
  return (
    <svg
      className="hiw-svg hiw-narrow"
      viewBox="0 0 300 746"
      role="img"
      aria-label={label}
      preserveAspectRatio="xMidYMid meet"
    >
      {GROUPS.map((g) => (
        <g key={g.name}>
          <rect className="hiw-group" x={8} y={g.y} width={260} height={g.h} rx={14} />
          <text className="hiw-phase" x={20} y={g.y + 22}>
            {g.name}
          </text>
        </g>
      ))}
      {NARROW_DOWN.map(([y1, y2]) => (
        <path
          key={`${y1}-${y2}`}
          className="hiw-edge"
          d={`M138 ${y1} L138 ${y2} ${arrowDown(138, y2)}`}
        />
      ))}
      <path className="hiw-loop" d={loop} />
      <text
        className="hiw-loop-label"
        x={295}
        y={(yCheck + yBuild) / 2}
        textAnchor="middle"
        transform={`rotate(-90 295 ${(yCheck + yBuild) / 2})`}
      >
        Sent back for another round
      </text>
      {narrow.map((b) => (
        <Node key={b.id} box={b} narrow />
      ))}
    </svg>
  );
}

export default function HowItWorks() {
  const { alt, caption } = profile.diagram;
  return (
    <figure className="hiw">
      <WideDrawing label={alt} />
      <NarrowDrawing label={alt} />
      <figcaption>{caption}</figcaption>
    </figure>
  );
}
