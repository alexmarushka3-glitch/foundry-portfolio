import { ICON_PATHS } from "@/components/AgentIcon";
import { subtitle } from "@/components/PipelineSvg";
import { AGENT_LIST } from "@/lib/agents";
import type { AgentFrame } from "@/lib/run";
import type { AgentName } from "@/lib/types";

/**
 * The demo window's sidebar: the eight agents in pipeline order, each with how far it got. It repeats what the
 * drawing already says (each node there is a button with its state as its name), so it is hidden from screen readers
 * and has no buttons of its own. It is left out of the phone layout in CSS, where the drawing needs the room.
 */
export default function AgentList({
  frames,
  selected,
}: {
  frames: AgentFrame[];
  selected: AgentName | null;
}) {
  const byId = new Map(frames.map((f) => [f.agent, f]));
  return (
    <ul className="agent-list" aria-hidden="true">
      {AGENT_LIST.map((a) => {
        const f = byId.get(a.id) ?? { agent: a.id, status: "pending", round: 0, text: "" };
        const state =
          f.status === "pending"
            ? "waiting"
            : f.status === "active"
              ? "working"
              : f.passed === false
                ? "sent-back"
                : "done";
        return (
          <li
            key={a.id}
            className={`agent state-${state}${selected === a.id ? " is-selected" : ""}`}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
              {ICON_PATHS[a.id].map((d) => (
                <path
                  key={d}
                  d={d}
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
            </svg>
            <span className="agent-name">{a.label}</span>
            <span className="agent-state">{subtitle(f as AgentFrame)}</span>
          </li>
        );
      })}
    </ul>
  );
}
