import DashboardSection from "@/components/admin/DashboardSection";
import ContactLinks from "@/components/ContactLinks";
import EvalCard from "@/components/EvalCard";
import Logo from "@/components/Logo";
import evalResults from "@/lib/eval/results.json";
import Stage from "@/components/Stage";
import { profile } from "@/lib/profile";
import { REALITY } from "@/lib/reality";
import type { Metadata } from "next";

// The old foundry-portfolio address serves the same page; this names the one search engines should keep.
export const metadata: Metadata = { alternates: { canonical: "/" } };

export default function Home() {
  return (
    <>
      <a className="skip" href="#top">
        Skip to content
      </a>
      <header className="nav">
        <a href="#top" className="brand">
          <Logo size={26} />
          <span>{profile.headline}</span>
        </a>
        <nav aria-label="Sections">
          <a href="#demo">Demo</a>
          <a href="#reality">Scope</a>
          <a href="#projects">Projects</a>
          <a href="#about">About</a>
        </nav>
        <a className="nav-resume" href="/Alex-Marushka-Resume.pdf" target="_blank" rel="noreferrer">
          Resume
        </a>
      </header>

      <main id="top">
        <section className="hero">
          <div className="lockup">
            <Logo className="hero-mark" />
            <h1>{profile.headline}</h1>
          </div>
          <p className="hero-tagline">{profile.tagline}</p>
          <p className="hero-lede">{profile.intro}</p>
          <div className="hero-actions">
            <a className="btn btn-primary" href="#demo">
              Watch it run
            </a>
            <a className="btn btn-ghost" href="#reality">
              Scope and limits
            </a>
          </div>
          <div className="hero-shot">
            {/* Hidden under 1100px; a lazy image that isn't shown is never downloaded. */}
            <img
              src="/foundry-pipeline.png"
              alt="The eight agents in a finished replay of a recorded live run, every step checked off."
              width={700}
              height={1080}
              loading="lazy"
            />
          </div>
          <p className="byline">
            {profile.name}, Business Economics student at the University of Chicago, class of 2029. Recruiting for consulting and tech
            roles.{" "}
            <ContactLinks label="Email" />
          </p>
        </section>

        <Stage />

        <section id="reality" className="section" aria-labelledby="reality-title">
          <h2 id="reality-title">Scope and limits</h2>
          <p className="lede">What runs for real, what is simulated, and what the limits are. Select any line for the detail.</p>
          <div className="reality">
            {REALITY.map((col) => (
              <div key={col.heading} className={`reality-col ${col.tone}`}>
                <h3>{col.heading}</h3>
                <ul>
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
          <EvalCard runs={evalResults.runs} />
        </section>

        <section id="dashboard" className="section" aria-labelledby="dashboard-title">
          <h2 id="dashboard-title">Watching the factory run</h2>
          <p className="lede">
            Every request built in the form is logged with its mode, result, time and cost. I use this dashboard to watch usage and to pause live
            runs. <strong>The numbers below are made up</strong> to show the layout. They are not real usage. The real one is behind a login.
          </p>
          <DashboardSection />
        </section>

        <section id="projects" className="section" aria-labelledby="projects-title">
          <h2 id="projects-title">Projects</h2>
          <ul className="projects">
            {profile.projects.map((p) => (
              <li key={p.name}>
                <h3>{p.name}</h3>
                <p>{p.blurb}</p>
                {p.links && (
                  <p className="project-links">
                    {p.links.map((l) => (
                      <a key={l.href} href={l.href} target="_blank" rel="noreferrer">
                        {l.label}
                      </a>
                    ))}
                  </p>
                )}
                <p className="tags">{p.tags.join(", ")}</p>
                {p.images && (
                  <figure className="project-shots">
                    {p.images.map((img) => (
                      <a key={img.src} href={img.src} target="_blank" rel="noreferrer">
                        <picture>
                          {img.animated && <source media="(prefers-reduced-motion: no-preference)" srcSet={img.animated} />}
                          <img src={img.src} alt={img.alt} width={img.width ?? 1800} height={img.height ?? 990} loading="lazy" />
                        </picture>
                      </a>
                    ))}
                    {p.note && <figcaption>{p.note}</figcaption>}
                  </figure>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section id="lessons" className="section" aria-labelledby="lessons-title">
          <h2 id="lessons-title">What building it taught me</h2>
          <ul className="lessons">
            {profile.lessons.map((l) => (
              <li key={l.title}>
                <h3>{l.title}</h3>
                <p>{l.body}</p>
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
            <ContactLinks />
          </p>
        </section>
      </main>

      <footer className="footer">
        <p>Built with Claude Code. The agents run on Claude models.</p>
        <p className="contact">
          <ContactLinks label="Email" />{" "}
          <a href="https://github.com/alexmarushka3-glitch/foundry-portfolio" target="_blank" rel="noreferrer">
            Site code
          </a>
        </p>
      </footer>
    </>
  );
}
