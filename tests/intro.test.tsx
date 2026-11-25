// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FactsStrip, Statement, Steps } from "@/components/home/Intro";
import { AGENT_LIST } from "@/lib/agents";

afterEach(cleanup);

describe("home intro sections", () => {
  it("shows the facts as things a live run includes, and nothing a simulation lacks is claimed outright", () => {
    render(<FactsStrip />);
    const group = screen.getByRole("group", { name: "What a live run includes" });
    expect(group.textContent).toMatch(/In a live run/);
    expect(group.textContent).toMatch(/Real unit tests/);
    expect(group.textContent).toMatch(/headless-Chrome/);
    expect(group.textContent).toMatch(/No human review/);
    // never says apps were reviewed, or promises reliability or a success rate
    expect(group.textContent).not.toMatch(/\breviewed\b|reliab|success rate/i);
  });

  it("says 'web app' once and then 'it' (the site's wording rule)", () => {
    const { container } = render(<Statement />);
    const text = container.textContent ?? "";
    expect(text.match(/web app/gi)).toHaveLength(1);
    expect(text).toMatch(/plans a small web app, builds it, and tests it in a real browser/);
  });

  it("covers all eight agents exactly once, in three steps", () => {
    const { container } = render(<Steps />);
    const titles = [...container.querySelectorAll(".step h3")].map((h) => h.textContent);
    expect(titles).toEqual(["Plan", "Build", "Check"]);
    const shown = [...container.querySelectorAll(".step-row span")].map((s) => s.textContent);
    expect(shown).toHaveLength(8);
    expect([...shown].sort()).toEqual(AGENT_LIST.map((a) => a.label).sort());
  });

  it("hides the decorative agent cards from screen readers and keeps the text readable", () => {
    const { container } = render(<Steps />);
    for (const card of container.querySelectorAll(".step-card")) {
      expect(card.getAttribute("aria-hidden")).toBe("true");
    }
    expect(container.querySelectorAll(".step p")).toHaveLength(3);
  });
});
