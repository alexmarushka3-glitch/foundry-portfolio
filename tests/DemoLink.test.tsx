// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import DemoLink from "@/components/DemoLink";

const media = (narrow: boolean) =>
  vi.stubGlobal("matchMedia", vi.fn().mockImplementation((q: string) => ({ matches: narrow && q.includes("max-width"), media: q })));

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

function setup() {
  const drawing = document.createElement("div");
  drawing.id = "demo-drawing";
  drawing.scrollIntoView = vi.fn();
  document.body.appendChild(drawing);
  render(<DemoLink>Build an app</DemoLink>);
  return { link: screen.getByRole("link", { name: "Build an app" }), drawing };
}

describe("the hero's Build an app link", () => {
  it("is a real link to #demo", () => {
    media(false);
    expect(setup().link.getAttribute("href")).toBe("#demo");
  });

  it("on a phone, scrolls to the drawing so the example plays on screen", () => {
    media(true);
    const { link, drawing } = setup();
    expect(fireEvent.click(link)).toBe(false); // default prevented
    expect(drawing.scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
  });

  it("on a desktop, leaves the normal jump to #demo alone", () => {
    media(false);
    const { link, drawing } = setup();
    expect(fireEvent.click(link)).toBe(true);
    expect(drawing.scrollIntoView).not.toHaveBeenCalled();
  });

  it("leaves Cmd/Ctrl-click alone", () => {
    media(true);
    const { link, drawing } = setup();
    expect(fireEvent.click(link, { metaKey: true })).toBe(true);
    expect(drawing.scrollIntoView).not.toHaveBeenCalled();
  });
});
