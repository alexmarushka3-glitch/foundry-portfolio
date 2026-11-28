import ContactLinks from "@/components/ContactLinks";
import DemoLink from "@/components/DemoLink";
import { FactsStrip, Statement, Steps } from "@/components/home/Intro";
import {
  AboutSection,
  ClosingBand,
  ProjectSection,
  ScopeSection,
  SiteFooter,
} from "@/components/home/Lower";
import Logo from "@/components/Logo";
import Stage from "@/components/Stage";
import ThemeToggle from "@/components/ThemeToggle";
import { profile } from "@/lib/profile";
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
          <a href="#project">Project</a>
          <a href="#reality">Scope</a>
          <a href="#about">About</a>
        </nav>
        <a className="nav-resume" href={profile.resume} target="_blank" rel="noreferrer">
          Resume
        </a>
        <ThemeToggle />
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-main">
            <div className="lockup">
              <Logo className="hero-mark" />
              <h1 className="sr-only">{profile.headline}</h1>
            </div>
            <p className="hero-tagline">{profile.tagline}</p>
          </div>
          <div className="hero-side">
            <p className="hero-lede">{profile.intro}</p>
            <div className="hero-actions">
              <DemoLink className="btn btn-primary">Build a web app</DemoLink>
              <a className="btn btn-ghost" href="#reality">
                Scope and limits
              </a>
            </div>
            <p className="byline">
              {profile.name}, Business Economics student at the University of Chicago, class of
              2029. Recruiting for consulting and tech roles. <ContactLinks label="Email" />
            </p>
          </div>
        </section>

        <FactsStrip />

        <Stage />

        <Statement />
        <Steps />

        <ProjectSection />
        <ScopeSection />
        <AboutSection />
        <ClosingBand />
      </main>

      <SiteFooter />
    </>
  );
}
