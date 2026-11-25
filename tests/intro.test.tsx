// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FactsStrip, Statement, Steps } from "@/components/home/Intro";
import { AGENT_LIST } from "@/lib/agents";

afterEach(cleanup);

const BANNED = /\breviewed\b|passed (code )?review|reliab|success rate/i;

describe("home intro sections", () => {
  it("labels the facts as what a live run includes", () => {
    render(<FactsStrip />);
    const group = screen.getByRole("group", { name: "What a live run includes" });
    expect(group.textContent).toMatch(/^In a live run/);
    expect(group.textContent).toMatch(/Real unit tests/);
    expect(group.textContent).toMatch(/headless Chrome/);
    expect(group.textContent).toMatch(/No human review/);
    expect(group.textContent).not.toMatch(BANNED);
  });

  it("picks out the three verbs and scopes the sentence to a live run", () => {
    const { container } = render(<Statement />);
    const text = container.textContent ?? "";
    expect(text).toMatch(/^In a live run, Foundry plans a small web app, builds it, and tests it/);
    expect(text.match(/web app/gi)).toHaveLength(1);
    expect([...container.querySelectorAll("mark")].map((m) => m.textContent)).toEqual([
      "plans",
      "builds",
      "tests",
    ]);
    expect(text).not.toMatch(BANNED);
  });

  it("covers all eight agents exactly once, in three steps", () => {
    const { container } = render(<Steps />);
    const titles = [...container.querySelectorAll(".step h3")].map((h) => h.textContent);
    expect(titles).toEqual(["Plan", "Build", "Check"]);
    const shown = [...container.querySelectorAll(".step-row span")].map((s) => s.textContent);
    expect(shown).toHaveLength(8);
    expect([...shown].sort()).toEqual(AGENT_LIST.map((a) => a.label).sort());
  });

  it("describes the steps the way the diagram caption does, without banned wording", () => {
    const { container } = render(<Steps />);
    const text = container.textContent ?? "";
    // only the Researcher reads the starter kit; the other two planners write the story and the blueprint
    expect(text).toMatch(/One agent reads the starter kit\. Two turn the idea into a story/);
    expect(text).not.toMatch(/Three agents read/);
    expect(text).toMatch(/In a live run, real tests can fail the build/);
    expect(text).not.toMatch(BANNED);
  });

  it("hides the decorative agent cards from screen readers and names the group for the outline", () => {
    const { container } = render(<Steps />);
    const cards = [...container.querySelectorAll(".step-card")];
    expect(cards).toHaveLength(3);
    for (const card of cards) expect(card.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector("h2.sr-only")?.textContent).toBe(
      "The eight agents in three steps",
    );
    expect(container.querySelectorAll(".step p")).toHaveLength(3);
  });
});
