import DashboardSection from "@/components/admin/DashboardSection";
import ContactLinks from "@/components/ContactLinks";
import Logo from "@/components/Logo";
import Stage from "@/components/Stage";
import { profile } from "@/lib/profile";
import { REALITY } from "@/lib/reality";

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
          <a href="#dashboard">Dashboard</a>
          <a href="#reality">What’s real</a>
          <a href="#projects">Projects</a>
          <a href="#about">About</a>
        </nav>
      </header>

      <main id="top">
        <section className="hero">
          <div className="lockup">
            <Logo className="hero-mark" />
            <h1>{profile.headline}</h1>
          </div>
          <p className="hero-lede">{profile.intro}</p>
          <p className="byline">
            {profile.name}, student at the University of Chicago.{" "}
            <ContactLinks label="Email" />
          </p>
        </section>

        <Stage />

        <section id="dashboard" className="section" aria-labelledby="dashboard-title">
          <h2 id="dashboard-title">Watching the factory run</h2>
          <p className="lede">
            Every typed idea is logged with its mode, result, time and cost. This is the dashboard I use to watch usage and pause live
            runs. The numbers below are made up for this page. The real one sits behind a login.
          </p>
          <DashboardSection />
        </section>

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
            <ContactLinks />
          </p>
        </section>
      </main>

      <footer className="footer">Built with Claude Code. The agents run on Claude models.</footer>
    </>
  );
}
