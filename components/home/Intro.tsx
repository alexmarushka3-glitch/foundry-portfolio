import { ICON_PATHS } from "@/components/AgentIcon";
import { AGENT_LIST } from "@/lib/agents";
import type { AgentName } from "@/lib/types";

const labelOf = (id: AgentName) => AGENT_LIST.find((a) => a.id === id)?.label ?? id;

/** What a live run includes. Said as a live run only: a simulation runs none of this (see the honesty rules). */
export function FactsStrip() {
  const facts = [
    "Claude agents",
    "Real unit tests",
    "A real headless-Chrome test",
    "No human review",
  ];
  return (
    <div className="facts" role="group" aria-label="What a live run includes">
      <p className="facts-label">In a live run</p>
      <ul>
        {facts.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
    </div>
  );
}

/** One sentence on what Foundry does. "Web app" once, then "it" (the site's wording rule). */
export function Statement() {
  return (
    <p className="statement">
      Foundry <mark>plans</mark> a small web app, <mark>builds</mark> it, and <mark>tests</mark> it
      in a real browser.{" "}
      <span className="statement-dim">You get one file that opens in any browser.</span>
    </p>
  );
}

const STEPS: { title: string; agents: AgentName[]; text: string }[] = [
  {
    title: "Plan",
    agents: ["researcher", "story", "pm"],
    text: "Three agents read the starter kit and turn the idea into a short plan, with checks you can see on the page.",
  },
  {
    title: "Build",
    agents: ["backend", "frontend"],
    text: "Two agents write the code and its unit tests, each one only its own files.",
  },
  {
    title: "Check",
    agents: ["e2e", "validator", "release"],
    text: "Real tests can fail the build and send it back. A Validator agent approves it, and Release writes it up.",
  },
];

/** The eight agents in three steps: three plan, two build, three check and hand over. */
export function Steps() {
  return (
    <div className="steps">
      {STEPS.map((s) => (
        <article key={s.title} className="step">
          <div className="step-card" aria-hidden="true">
            {s.agents.map((id) => (
              <div key={id} className="step-row">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
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
              </div>
            ))}
          </div>
          <h3>{s.title}</h3>
          <p>{s.text}</p>
        </article>
      ))}
    </div>
  );
}
