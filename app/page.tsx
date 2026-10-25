import Stage from "@/components/Stage";
import { profile } from "@/lib/profile";

const REALITY = [
  {
    heading: "Real",
    items: [
      "Each stage in the three example runs was its own Claude agent, fed the previous stage's real output.",
      "The pipeline code, the streaming, and the stage you just watched.",
      "Typed ideas run on live Claude models when the live switch is on. The badge on the stage says which mode you are in.",
      "Three recorded runs. All passed both of the pipeline's AI checks on the first round, in 72 to 94 seconds each.",
    ],
  },
  {
    heading: "Simulated",
    items: [
      "A typed idea with the live switch off runs scripted text. The badge says Simulated.",
      "The task-tracker app the agents work on. It is a toy of about 36 lines.",
    ],
  },
  {
    heading: "Not done yet",
    items: [
      "The generated code was never run.",
      "The E2E Verifier is an agent reasoning through flows. It does not drive a browser.",
      "No recording has needed the send-back round. Only the simulation shows it.",
      "No real pull request is opened, and no human reviews it. Three runs is a demo, not a success rate.",
    ],
  },
];

export default function Home() {
  return (
    <>
      <a className="skip" href="#top">
        Skip to content
      </a>
      <header className="nav">
        <a href="#top" className="brand">
          {profile.name}
        </a>
        <nav aria-label="Sections">
          <a href="#demo">Demo</a>
          <a href="#reality">What’s real</a>
          <a href="#projects">Projects</a>
          <a href="#about">About</a>
        </nav>
      </header>

      <main id="top">
        <section className="hero">
          <h1>{profile.pitch}</h1>
          <p className="byline">
            {profile.name}, student at the University of Chicago.{" "}
            <a href={`mailto:${profile.email}`}>Email</a>
            {profile.links.map((l) => (
              <span key={l.label}>
                {" "}
                <a href={l.href} target="_blank" rel="noreferrer">
                  {l.label}
                </a>
              </span>
            ))}
          </p>
        </section>

        <Stage />

        <section id="reality" className="section" aria-labelledby="reality-title">
          <h2 id="reality-title">What’s real and what isn’t</h2>
          <p className="lede">A demo is only worth showing if you can tell what's behind it. Here is exactly that.</p>
          <div className="reality">
            {REALITY.map((col) => (
              <div key={col.heading} className={`reality-col ${col.heading.toLowerCase().replace(/\s+/g, "-")}`}>
                <h3>{col.heading}</h3>
                <ul>
                  {col.items.map((it) => (
                    <li key={it}>{it}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section id="projects" className="section" aria-labelledby="projects-title">
          <h2 id="projects-title">Projects</h2>
          <ul className="projects">
            {profile.projects.map((p) => (
              <li key={p.name}>
                <h3>{p.name}</h3>
                <p>{p.blurb}</p>
                <p className="tags">{p.tags.join(", ")}</p>
              </li>
            ))}
          </ul>
        </section>

        <section id="about" className="section" aria-labelledby="about-title">
          <h2 id="about-title">About</h2>
          <div className="about">
            {profile.about.map((para) => (
              <p key={para}>{para}</p>
            ))}
          </div>
          <p className="contact">
            <a href={`mailto:${profile.email}`}>{profile.email}</a>
            {profile.links.map((l) => (
              <span key={l.label}>
                {" "}
                <a href={l.href} target="_blank" rel="noreferrer">
                  {l.label}
                </a>
              </span>
            ))}
          </p>
        </section>
      </main>

      <footer className="footer">Built with Claude Code. The agents run on Claude models.</footer>
    </>
  );
}
