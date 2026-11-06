import ContactLinks from "@/components/ContactLinks";
import DemoLink from "@/components/DemoLink";
import Logo from "@/components/Logo";
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
            <DemoLink className="btn btn-primary">Build an app</DemoLink>
            <a className="btn btn-ghost" href="#reality">
              Scope and limits
            </a>
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
          <p className="lede">Select any line for the detail.</p>
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
