// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Home from "@/app/page";
import { profile } from "@/lib/profile";

beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({ matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {} })),
  );
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ live: false })));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Home page", () => {
  it("opens with the Foundry title, the longer description, and who built it", () => {
    const { container } = render(<Home />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Foundry");
    expect(screen.getByText(profile.intro)).toBeTruthy();
    expect(container.querySelector(".hero .byline")?.textContent).toMatch(/Alex Marushka, student at the University of Chicago/);
  });

  it("shows the logo in the nav and next to the title, hidden from screen readers", () => {
    const { container } = render(<Home />);
    const marks = container.querySelectorAll("svg[aria-hidden='true']");
    expect(container.querySelector(".nav .brand svg")).toBeTruthy();
    expect(container.querySelector(".hero .hero-mark")).toBeTruthy();
    expect(marks.length).toBeGreaterThanOrEqual(2);
  });

  it("names the site in the nav and links the sections in page order, with the dashboard before What's real", () => {
    render(<Home />);
    const nav = within(screen.getByRole("navigation", { name: "Sections" }));
    expect(nav.getAllByRole("link").map((a) => a.textContent)).toEqual(["Demo", "Dashboard", "What’s real", "Projects", "About"]);
    expect(screen.getByRole("link", { name: "Foundry" }).getAttribute("href")).toBe("#top");

    const ids = [...document.querySelectorAll("main > section")].map((s) => s.id);
    expect(ids.indexOf("demo")).toBeLessThan(ids.indexOf("dashboard"));
    expect(ids.indexOf("dashboard")).toBeLessThan(ids.indexOf("reality"));
  });

  it("has no link to the admin demo page, and every nav link points at a real section", () => {
    const { container } = render(<Home />);
    expect(container.querySelector("a[href='/admin-demo']")).toBeNull();
    for (const a of container.querySelectorAll(".nav nav a")) {
      const id = a.getAttribute("href")!.slice(1);
      expect(container.querySelector(`#${id}`), `section #${id}`).toBeTruthy();
    }
  });
});
