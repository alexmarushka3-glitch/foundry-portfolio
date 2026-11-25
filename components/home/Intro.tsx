import { ICON_PATHS } from "@/components/AgentIcon";
import { AGENT_LIST } from "@/lib/agents";
import { profile } from "@/lib/profile";
import type { AgentName } from "@/lib/types";

const labelOf = (id: AgentName) => AGENT_LIST.find((a) => a.id === id)?.label ?? id;

/** What a live run includes. Said as a live run only: a simulation runs none of it (see the honesty rules). */
export function FactsStrip() {
  return (
    <div className="facts" role="group" aria-label="What a live run includes">
      <p className="facts-label">In a live run</p>
      <ul>
        {profile.facts.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
    </div>
  );
}

const VERBS = /\b(plans|builds|tests)\b/;

/** One sentence on what Foundry does (copy in lib/profile.ts), with the verbs picked out. */
export function Statement() {
  return (
    <p className="statement">
      {profile.statement.split(VERBS).map((part, i) =>
        // split() with a capture group puts the matched verbs at the odd positions
        i % 2 === 1 ? <mark key={i}>{part}</mark> : part,
      )}
    </p>
  );
}

/** The eight agents in three steps: three plan, two build, three check and hand over. */
export function Steps() {
  return (
    <div className="steps">
      <h2 className="sr-only">The eight agents in three steps</h2>
      {profile.steps.map((s) => (
        <article key={s.title} className="step">
          <ul className="step-card" aria-label={`${s.title}: the agents`}>
            {s.agents.map((id) => (
              <li key={id} className="step-row">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
                  {ICON_PATHS[id].map((d) => (
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
                <span>{labelOf(id)}</span>
              </li>
            ))}
          </ul>
          <h3>{s.title}</h3>
          <p>{s.text}</p>
        </article>
      ))}
    </div>
  );
}
