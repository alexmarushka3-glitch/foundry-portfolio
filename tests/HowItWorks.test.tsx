// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import HowItWorks from "@/components/HowItWorks";
import { AGENT_LIST } from "@/lib/agents";
import { profile } from "@/lib/profile";

describe("How it works picture", () => {
  afterEach(cleanup);

  it("draws both layouts, each with all eight agents, the idea and the app", () => {
    const { container } = render(<HowItWorks />);
    for (const cls of ["hiw-wide", "hiw-narrow"]) {
      const svg = container.querySelector(`svg.${cls}`)!;
      const labels = [...svg.querySelectorAll(".hiw-label")].map((t) => t.textContent);
      for (const a of AGENT_LIST) expect(labels).toContain(a.label);
      expect(labels).toContain("Your idea");
      expect(labels).toContain("Your app");
      expect(svg.querySelectorAll(".node-icon")).toHaveLength(8);
      expect(svg.textContent).toContain("Sent back for another round");
    }
  });

  it("draws the loop arrowhead as its own solid line in both drawings, and keeps the app box inside the narrow one", async () => {
    const { container } = render(<HowItWorks />);
    for (const cls of ["hiw-wide", "hiw-narrow"]) {
      const svg = container.querySelector(`svg.${cls}`)!;
      expect(svg.querySelectorAll("path.hiw-loop-arrow")).toHaveLength(1);
      expect(svg.querySelector("path.hiw-loop")?.getAttribute("d")).not.toMatch(
        /L[\d.]+ [\d.]+ L[\d.]+ [\d.]+$/m,
      );
    }
    expect(container.querySelector("svg.hiw-narrow")?.getAttribute("viewBox")).toBe("0 -2 300 750");
    const { readFileSync } = await import("node:fs");
    const css = readFileSync("app/globals.css", "utf8");
    expect(css.match(/\.hiw-loop-arrow\s*\{[^}]*\}/)?.[0]).not.toMatch(/dasharray/);
  });

  it("describes itself to screen readers and says no human reviews the apps", () => {
    const { container } = render(<HowItWorks />);
    for (const svg of container.querySelectorAll("svg.hiw-svg")) {
      expect(svg.getAttribute("role")).toBe("img");
      expect(svg.getAttribute("aria-label")).toBe(profile.diagram.alt);
    }
    expect(container.querySelector("figcaption")?.textContent).toBe(profile.diagram.caption);
    expect(profile.diagram.caption).toMatch(/no human reviews/i);
  });

  it("is a still picture: nothing in its styles animates", async () => {
    const { readFileSync } = await import("node:fs");
    const css = readFileSync("app/globals.css", "utf8");
    const rules = css.match(/\.hiw[^{]*\{[^}]*\}/g) ?? [];
    expect(rules.length).toBeGreaterThan(5);
    for (const rule of rules) expect(rule).not.toMatch(/animation|transition/);
  });
});
