import ContactLinks from "@/components/ContactLinks";
import DemoLink from "@/components/DemoLink";
import HowItWorks from "@/components/HowItWorks";
import { profile } from "@/lib/profile";
import { REALITY } from "@/lib/reality";

const RESUME = profile.links.find((l) => l.label === "Resume")!.href;

/** The project in short: the case rows beside the heading, the diagram, then the decisions as numbered cards. */
export function ProjectSection() {
  return (
    <section id="project" className="section project" aria-labelledby="project-title">
      <div className="project-head">
        <h2 id="project-title">The project in short</h2>
        <dl className="case">
          {profile.caseStudy.map((row) => (
            <div key={row.term}>
              <dt>{row.term}</dt>
              <dd>{row.text}</dd>
            </div>
          ))}
        </dl>
      </div>
      <HowItWorks />
      <h3 className="case-sub">Decisions that mattered</h3>
      <ul className="lessons" role="list">
        {profile.lessons.map((l) => (
          <li key={l.title}>
            <h4>{l.title}</h4>
            <p>{l.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** What works and what it does not do, one expandable line each. */
export function ScopeSection() {
  return (
    <section id="reality" className="section" aria-labelledby="reality-title">
      <h2 id="reality-title">Scope and limits</h2>
      <p className="lede">Select any line for the detail.</p>
      <div className="reality">
        {REALITY.map((col) => (
          <div key={col.heading} className={`reality-col ${col.tone}`}>
            <h3>{col.heading}</h3>
            <ul role="list">
              {col.items.map((it, i) => (
                <li key={it}>
                  <details>
                    <summary>{col.short[i]}</summary>
                    <p>{it}</p>
                  </details>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

export function AboutSection() {
  return (
    <section id="about" className="section about-section" aria-labelledby="about-title">
      <h2 id="about-title">About</h2>
      <div>
        <div className="about">
          {profile.about.map((para) => (
            <p key={para}>{para}</p>
          ))}
        </div>
        <p className="contact">
          <ContactLinks />
        </p>
      </div>
    </section>
  );
}

/** A dark band that ends the page. It points at the demo and the resume and claims nothing new. */
export function ClosingBand() {
  return (
    <section className="closing" aria-labelledby="closing-title">
      <div>
        <h2 id="closing-title">{profile.closing.title}</h2>
        <p>{profile.closing.text}</p>
      </div>
      <div className="closing-actions">
        <DemoLink className="btn btn-primary">Build a web app</DemoLink>
        <a className="btn btn-on-iron" href={RESUME} target="_blank" rel="noreferrer">
          Resume
        </a>
      </div>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className="footer">
      <p>
        Built with Claude Code. The agents run on Claude models. Visits are counted with Vercel Web
        Analytics, without cookies.
      </p>
      <p className="contact">
        <ContactLinks label="Email" />{" "}
        <a
          href="https://github.com/alexmarushka3-glitch/foundry-portfolio"
          target="_blank"
          rel="noreferrer"
        >
          Site code
        </a>{" "}
        <a href={profile.figma.href} target="_blank" rel="noreferrer">
          {profile.figma.label}
        </a>
      </p>
      <p className="contact">{profile.figma.note}</p>
    </footer>
  );
}
