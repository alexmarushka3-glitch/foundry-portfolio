import type { AgentName } from "@/lib/types";

/**
 * One 24px glyph per agent: 2px stroke, round ends and joins, no fill. The colour comes from the
 * node's run state (see `.node-icon` in globals.css), so an icon only changes when a real run
 * (or a replay of one) is playing. Drawn on a 24 x 24 grid.
 */
export const ICON_PATHS: Record<AgentName, string[]> = {
  // magnifier
  researcher: ["M10.5 4.5a6 6 0 1 0 0 12a6 6 0 0 0 0-12z", "M15 15l5.5 5.5"],
  // page with lines
  story: [
    "M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z",
    "M9 9h6M9 13h6M9 17h3",
  ],
  // checklist
  pm: ["M4 6.5l1.5 1.5L8.5 5M4 12.5L5.5 14l3-3M4 18.5L5.5 20l3-3", "M12 6.5h8M12 12.5h8M12 18.5h8"],
  // curly braces
  backend: [
    "M9 4C6.5 4 6.5 7 6.5 9C6.5 11 5 12 3.5 12C5 12 6.5 13 6.5 15C6.5 17 6.5 20 9 20",
    "M15 4C17.5 4 17.5 7 17.5 9C17.5 11 19 12 20.5 12C19 12 17.5 13 17.5 15C17.5 17 17.5 20 15 20",
  ],
  // window with a sidebar
  frontend: [
    "M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
    "M3 9h18M9 9v11",
  ],
  // globe: a real browser
  e2e: [
    "M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18z",
    "M3 12h18",
    "M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18",
  ],
  // shield with a check
  validator: ["M12 3l8 3v6c0 4.5-3.2 7.8-8 9c-4.8-1.2-8-4.5-8-9V6z", "M8.5 12l2.5 2.5l4.5-5"],
  // package
  release: ["M12 3l8 4.5v9L12 21l-8-4.5v-9z", "M4 7.5l8 4.5l8-4.5", "M12 12v9"],
};

/** Draws an agent's glyph inside a parent <svg>, with its top left corner at (x, y). */
export default function AgentIcon({ agent, x, y }: { agent: AgentName; x: number; y: number }) {
  return (
    <svg
      className="node-icon"
      x={x}
      y={y}
      width={24}
      height={24}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      {ICON_PATHS[agent].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
