import Demo from "@/components/Demo";
import { profile } from "@/lib/profile";

export default function Home() {
  return (
    <>
      <nav className="nav">
        <a href="#top" className="brand">{profile.name}</a>
        <div className="navlinks">
          <a href="#demo">Live demo</a>
          <a href="#projects">Projects</a>
          <a href="#about">About</a>
          <a href={`mailto:${profile.email}`}>Contact</a>
        </div>
      </nav>

      <main id="top">
        <section className="hero">
          <p className="eyebrow">{profile.title}</p>
          <h1>{profile.pitch}</h1>
          <div className="cta">
            <a className="btn primary" href="#demo">Watch the agents work</a>
            <a className="btn" href={`mailto:${profile.email}`}>Get in touch</a>
          </div>
          <dl className="stats">
            {profile.stats.map((s) => (
              <div key={s.label}>
                <dt>{s.value}</dt>
                <dd>{s.label}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section id="demo" className="section">
          <h2>Foundry, live</h2>
          <p className="lede">
            Give a rough idea for a small task-tracker app. A read-only researcher reads the code, a story writer and project
            manager shape the spec, backend and frontend engineers build in parallel, then an end-to-end verifier and a
            validator check the result. Failed work goes back for a second round. The three example requests replay real
            runs, where every stage was a separate Claude agent. Custom requests use a scripted simulation.
          </p>
          <Demo />
        </section>

        <section id="projects" className="section">
          <h2>Projects</h2>
          <div className="grid">
            {profile.projects.map((p) => (
              <article key={p.name} className="card">
                <h3>{p.name}</h3>
                <p>{p.blurb}</p>
                <ul className="tags">
                  {p.tags.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section id="about" className="section">
          <h2>About</h2>
          {profile.about.map((para) => (
            <p key={para} className="lede">{para}</p>
          ))}
          <p className="links">
            {profile.links.map((l) => (
              <a key={l.label} href={l.href} target="_blank" rel="noreferrer">{l.label}</a>
            ))}
            <a href={`mailto:${profile.email}`}>{profile.email}</a>
          </p>
        </section>
      </main>

      <footer className="footer">Built with Claude Code. Agents run on Claude models.</footer>
    </>
  );
}
