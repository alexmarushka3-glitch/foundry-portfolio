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

  it("describes the steps accurately: one agent reads the starter kit, and the Validator checks rather than always approves", () => {
    const { container } = render(<Steps />);
    const text = container.textContent ?? "";
    // only the Researcher reads the starter kit; the other two planners write the story and the blueprint
    expect(text).toMatch(/One agent reads the starter kit\. Two turn the idea into a story/);
    expect(text).not.toMatch(/Three agents read/);
    expect(text).toMatch(/In a live run, real tests can fail the build/);
    expect(text).toMatch(/Validator agent checks it against the story and the tests/);
    expect(text).not.toMatch(/approves it/);
    expect(text).not.toMatch(BANNED);
  });

  it("lists the agents in each step for screen readers and names the group for the outline", () => {
    const { container } = render(<Steps />);
    const lists = [...container.querySelectorAll("ul.step-card")];
    expect(lists).toHaveLength(3);
    expect(lists.map((l) => l.getAttribute("aria-label"))).toEqual([
      "Plan: the agents",
      "Build: the agents",
      "Check: the agents",
    ]);
    // the agent names are real list items, not hidden; only the decorative icons are hidden
    expect(container.querySelectorAll("ul.step-card > li")).toHaveLength(8);
    expect(container.querySelector(".step-card[aria-hidden]")).toBeNull();
    for (const svg of container.querySelectorAll(".step-row svg"))
      expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector("h2.sr-only")?.textContent).toBe(
      "The eight agents in three steps",
    );
    expect(container.querySelectorAll(".step p")).toHaveLength(3);
  });
});
