import { ICON_PATHS } from "@/components/AgentIcon";
import { agentState, subtitle } from "@/components/PipelineSvg";
import { AGENT_LIST } from "@/lib/agents";
import type { AgentFrame } from "@/lib/run";

/**
 * The demo window's sidebar: the eight agents in pipeline order, each with how far it got. It repeats what the
 * drawing already says (each node there is a button with its state as its name), so it is hidden from screen readers
 * and has no buttons of its own: it only reports, it does not select (the drawing's nodes do that). It is left out of
 * the phone layout in CSS, where the drawing needs the room.
 */
export default function AgentList({ frames }: { frames: AgentFrame[] }) {
  const byId = new Map(frames.map((f) => [f.agent, f]));
  return (
    <ul className="agent-list" aria-hidden="true">
      {AGENT_LIST.map((a) => {
        const f: AgentFrame = byId.get(a.id) ?? {
          agent: a.id,
          status: "pending",
          round: 0,
          text: "",
        };
        return (
          <li key={a.id} className={`agent state-${agentState(f)}`}>
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
            <span className="agent-state">{subtitle(f)}</span>
          </li>
        );
      })}
    </ul>
  );
}
