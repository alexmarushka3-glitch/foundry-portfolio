// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AboutSection,
  ClosingBand,
  ProjectSection,
  ScopeSection,
  SiteFooter,
} from "@/components/home/Lower";
import { profile } from "@/lib/profile";
import { REALITY } from "@/lib/reality";

beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const BANNED = /\breviewed\b|passed (code )?review|reliab|success rate/i;
const webApps = (text: string) => (text.match(/web app/gi) ?? []).length;

describe("lower home sections", () => {
  it("keeps the project section id and heading, with the case rows, the diagram and the decisions", () => {
    const { container } = render(<ProjectSection />);
    const section = container.querySelector("section#project")!;
    expect(section).toBeTruthy();
    expect(
      within(section as HTMLElement).getByRole("heading", {
        level: 2,
        name: "The project in short",
      }),
    ).toBeTruthy();
    expect(section.querySelectorAll("dl.case dt")).toHaveLength(profile.caseStudy.length);
    expect(section.querySelector("figure, .hiw")).toBeTruthy();
    expect(section.querySelectorAll("ul.lessons > li")).toHaveLength(profile.lessons.length);
    for (const l of profile.lessons) {
      expect(
        within(section as HTMLElement).getByRole("heading", { level: 4, name: l.title }),
      ).toBeTruthy();
    }
  });

  it("keeps the scope section id, one expandable line per item, and the hint", () => {
    const { container } = render(<ScopeSection />);
    const section = container.querySelector("section#reality")!;
    expect(section).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Scope and limits" })).toBeTruthy();
    expect(section.textContent).toContain("Select any line for the detail.");
    const total = REALITY.reduce((n, c) => n + c.items.length, 0);
    expect(section.querySelectorAll("details > summary")).toHaveLength(total);
    for (const col of REALITY) {
      expect(
        within(section as HTMLElement).getByRole("heading", { level: 3, name: col.heading }),
      ).toBeTruthy();
    }
  });

  it("keeps the about section id with every paragraph and the contact links", () => {
    const { container } = render(<AboutSection />);
    const section = container.querySelector("section#about")!;
    expect(section).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "About" })).toBeTruthy();
    for (const para of profile.about) expect(section.textContent).toContain(para);
    expect(section.querySelector(`a[href='mailto:${profile.email}']`)).toBeTruthy();
  });

  it("ends with a closing band that links the demo and the resume, and makes no new claim", () => {
    const { container } = render(<ClosingBand />);
    const band = container.querySelector("section.closing")!;
    expect(band).toBeTruthy();
    expect(band.getAttribute("aria-labelledby")).toBeTruthy();
    expect(
      within(band as HTMLElement).getByRole("heading", { level: 2, name: profile.closing.title }),
    ).toBeTruthy();
    expect(band.textContent).toContain(profile.closing.text);
    expect(band.querySelector("a[href='#demo']")).toBeTruthy();
    expect(band.querySelector(`a[href='${profile.resume}']`)).toBeTruthy();
    expect(profile.resume).toBe("/Alex-Marushka-Resume.pdf");
    expect(band.textContent).not.toMatch(BANNED);
    expect(webApps(band.textContent ?? "")).toBeLessThanOrEqual(1); // "web app" once per section
  });

  it("keeps the footer text, the site-code link and the Figma link with its note", () => {
    const { container } = render(<SiteFooter />);
    const footer = container.querySelector("footer")!;
    expect(footer.textContent).toContain("Built with Claude Code.");
    expect(footer.textContent).toContain("Vercel Web Analytics, without cookies");
    expect(
      footer.querySelector("a[href='https://github.com/alexmarushka3-glitch/foundry-portfolio']"),
    ).toBeTruthy();
    const figma = footer.querySelector(`a[href='${profile.figma.href}']`)!;
    expect(figma.getAttribute("target")).toBe("_blank");
    expect(figma.getAttribute("rel")).toContain("noreferrer");
    expect(footer.textContent).toContain(profile.figma.note);
    expect(footer.querySelector(`a[href='mailto:${profile.email}']`)).toBeTruthy();
  });
});
