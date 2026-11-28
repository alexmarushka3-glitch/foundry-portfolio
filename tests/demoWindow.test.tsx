// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, configure, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AgentList from "@/components/stage/AgentList";
import Stage from "@/components/Stage";
import type { AgentFrame } from "@/lib/run";
import { AGENT_LIST } from "@/lib/agents";
import { FIXTURE_REQUEST, fixtureRecording } from "./fixtures/liveRecording";

configure({ asyncUtilTimeout: 4000 });

vi.mock("@/lib/liveRecordings.json", () => ({ default: { recordings: [] } }));
vi.mock("@/lib/liveReplay", async (orig) => {
  const mod = await orig<typeof import("@/lib/liveReplay")>();
  const { fixtureRecording } = await import("./fixtures/liveRecording");
  const rec = fixtureRecording();
  return {
    ...mod,
    loadLiveRecording: async (request: string) => mod.findLiveRecording([rec], request),
  };
});
vi.mock("@/lib/exampleRequests", () => ({
  EXAMPLE_REQUESTS: ["Let users set a due date on tasks"],
}));

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
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ live: false })),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const css = readFileSync(join(process.cwd(), "app", "globals.css"), "utf8");

/** The text of the 900px media block that holds the demo's phone layout (the one with .stage-main in it). */
function phoneBlock() {
  const at = css.search(/\.stage-main \{\s*display: flex;/);
  expect(at, ".stage-main phone rule").toBeGreaterThan(-1);
  const start = css.lastIndexOf("@media", at);
  // the block ends at the first closing brace in column 0 (line endings may be LF or CRLF on this machine)
  const block = css.slice(start, at + css.slice(at).search(/\r?\n\}/));
  expect(block).toMatch(/^@media \(max-width: 900px\)/);
  return block;
}

/** Rows of the sidebar as [name, status]. */
const rows = (root: HTMLElement) =>
  [...root.querySelectorAll(".agent-list > li")].map((li) => [
    li.querySelector(".agent-name")?.textContent,
    li.querySelector(".agent-state")?.textContent,
  ]);

describe("demo window", () => {
  it("is one section with the same id and heading, framed by a title bar and a sidebar", () => {
    const { container } = render(<Stage />);
    const section = container.querySelector("section#demo.stage")!;
    expect(section.getAttribute("aria-labelledby")).toBe("stage-title");
    expect(section.querySelector("h2#stage-title")?.textContent).toBe("Build a web app");
    expect(section.querySelector(":scope > .stage-bar")).not.toBeNull();
    expect(section.querySelector(":scope > .stage-body > .agent-list")).not.toBeNull();
    expect(section.querySelector(":scope > .stage-body > .stage-main")).not.toBeNull();
  });

  it("keeps the phone ordering working: the ordered pieces are direct children of .stage-main", () => {
    const { container } = render(<Stage />);
    const main = container.querySelector(".stage-main")!;
    for (const sel of [".stage-head", ".idea", ".pipeline-wrap", ".panels", ".player"]) {
      expect(main.querySelector(`:scope > ${sel}`), sel).not.toBeNull();
    }
    // the title bar and the sidebar are outside it, so the 900px reordering never touches them
    expect(main.querySelector(".stage-bar, .agent-list")).toBeNull();
    // the flex column and its order rules now hang on .stage-main, inside the 900px query
    expect(phoneBlock()).toMatch(/\.stage-main \{\s*display: flex;\s*flex-direction: column;/);
    expect(phoneBlock()).toMatch(/\.stage-head \{\s*order: 0;/);
  });

  it("says what the build is called before any run, then names the idea once a run starts", async () => {
    const { container } = render(<Stage />);
    expect(container.querySelector(".stage-bar .crumb")?.textContent).toMatch(/Build.*New build/);
    fireEvent.click(screen.getByRole("button", { name: FIXTURE_REQUEST }));
    expect(await screen.findByText("Replay of a real live run")).toBeTruthy();
    expect(container.querySelector(".stage-bar .crumb")?.textContent).toContain(FIXTURE_REQUEST);
  });

  it("moves the mode badge into the title bar: one badge, still a status message", async () => {
    const { container } = render(<Stage />);
    expect(container.querySelector(".badge")).toBeNull(); // nothing ran yet, so no mode to state
    fireEvent.click(screen.getByRole("button", { name: FIXTURE_REQUEST }));
    const badge = await screen.findByText("Replay of a real live run");
    expect(container.querySelectorAll(".badge")).toHaveLength(1);
    expect(badge.closest(".stage-bar")).not.toBeNull();
    expect(badge.closest(".badge")?.getAttribute("role")).toBe("status");
    expect(container.querySelector(".stage-head .badge")).toBeNull();
  });

  it("lists all eight agents in pipeline order, all waiting before a run", () => {
    const { container } = render(<Stage />);
    expect(rows(container)).toEqual(AGENT_LIST.map((a) => [a.label, "waiting"]));
  });

  it("shows how far each agent got, and hides the sidebar from screen readers (the drawing already says it)", async () => {
    const { container } = render(<Stage />);
    expect(container.querySelector(".agent-list")?.getAttribute("aria-hidden")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: FIXTURE_REQUEST }));
    await screen.findByText("Replay of a real live run");
    const scrub = screen.getByLabelText("Scrub through the run") as HTMLInputElement;
    fireEvent.change(scrub, { target: { value: scrub.max } });
    const finished = rows(container);
    expect(finished).toHaveLength(8);
    expect(finished.some(([, state]) => state === "waiting")).toBe(false);
    expect(finished.find(([name]) => name === "Researcher")?.[1]).not.toBe("waiting");
    // the sidebar adds no second button per agent: the drawing's nodes stay the only ones (the tests and screen
    // readers look them up by name)
    expect(screen.getAllByRole("button", { name: /^Researcher:/ })).toHaveLength(1);
    expect(container.querySelectorAll(".agent-list button")).toHaveLength(0);
  });

  it("hides the sidebar on phones, and the title bar and body stay in the layout", () => {
    expect(phoneBlock()).toMatch(/\.agent-list \{\s*display: none;/);
    expect(phoneBlock()).toMatch(/\.stage-body \{\s*grid-template-columns: minmax\(0, 1fr\);/);
    expect(css).toMatch(/\.stage-bar \{/);
  });

  it("words and colours each state from one place: waiting, working, passed, sent back, done", () => {
    const frame = (agent: AgentFrame["agent"], f: Partial<AgentFrame>): AgentFrame => ({
      agent,
      status: "done",
      round: 1,
      text: "",
      ...f,
    });
    const { container } = render(
      <AgentList
        frames={[
          frame("researcher", { status: "pending", round: 0 }),
          frame("story", { status: "active" }),
          frame("pm", { passed: true }),
          frame("backend", { passed: false }),
          frame("frontend", { ms: 4200 }),
        ]}
      />,
    );
    const li = (name: string) =>
      [...container.querySelectorAll(".agent-list > li")].find(
        (x) => x.querySelector(".agent-name")?.textContent === name,
      )!;
    const state = (name: string) => [
      [...li(name).classList].find((c) => c.startsWith("state-")),
      li(name).querySelector(".agent-state")?.textContent,
    ];
    expect(state("Researcher")).toEqual(["state-waiting", "waiting"]);
    expect(state("Story Writer")).toEqual(["state-working", "working"]);
    expect(state("Project Manager")).toEqual(["state-done", "passed"]);
    expect(state("Logic")).toEqual(["state-sent-back", "sent back"]);
    expect(state("Interface")).toEqual(["state-done", "4.2s"]);
    // an agent with no frame yet still gets a row, waiting
    expect(state("Release")).toEqual(["state-waiting", "waiting"]);
    expect(container.querySelectorAll(".agent-list > li")).toHaveLength(8);
  });

  it("gives the title bar the full idea as a hover title, in case it is cut off", async () => {
    const { container } = render(<Stage />);
    fireEvent.click(screen.getByRole("button", { name: FIXTURE_REQUEST }));
    await screen.findByText("Replay of a real live run");
    expect(container.querySelector(".crumb-idea")?.getAttribute("title")).toBe(FIXTURE_REQUEST);
  });

  it("draws the tall layout between 901px and 1200px, where the sidebar leaves the wide drawing too little room", async () => {
    // matches only the 1200px query: a window wider than a phone, narrower than the wide drawing needs
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: query === "(max-width: 1200px)",
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      })),
    );
    const { container } = render(<Stage />);
    await waitFor(() => expect(container.querySelector("svg.pipeline-narrow")).toBeTruthy());
    // it is still the desktop frame: the sidebar stays, and the phone-only strip does not appear
    expect(container.querySelector(".agent-list")).toBeTruthy();
    expect(container.querySelector(".now-strip")).toBeNull();
  });

  it("draws the wide layout above 1200px", () => {
    const { container } = render(<Stage />); // the default stub matches no query
    expect(container.querySelector("svg.pipeline")).toBeTruthy();
    expect(container.querySelector("svg.pipeline-narrow")).toBeNull();
  });

  it("keeps the phone behaviours on the 900px query: starting a run scrolls the drawing into view on a phone, not at 901-1200px", async () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll; // jsdom has none
    // the drawing is below the fold, so a phone would scroll to it
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
      top: 5000,
      bottom: 5400,
      left: 0,
      right: 0,
      width: 0,
      height: 400,
      x: 0,
      y: 5000,
      toJSON: () => ({}),
    });
    const media = (matches: (q: string) => boolean) =>
      vi.stubGlobal(
        "matchMedia",
        vi.fn().mockImplementation((query: string) => ({
          matches: matches(query),
          media: query,
          addEventListener: () => {},
          removeEventListener: () => {},
        })),
      );
    try {
      media((q) => q === "(max-width: 1200px)"); // 901-1200px
      let view = render(<Stage />);
      await waitFor(() => expect(view.container.querySelector("svg.pipeline-narrow")).toBeTruthy());
      fireEvent.click(screen.getByRole("button", { name: FIXTURE_REQUEST }));
      await screen.findByText("Replay of a real live run");
      expect(scroll, "no scrolling at 901-1200px").not.toHaveBeenCalled();
      cleanup();

      media(() => true); // a phone: every query matches
      view = render(<Stage />);
      await waitFor(() => expect(view.container.querySelector("svg.pipeline-narrow")).toBeTruthy());
      fireEvent.click(screen.getByRole("button", { name: FIXTURE_REQUEST }));
      await screen.findByText("Replay of a real live run");
      await waitFor(() => expect(scroll, "a phone scrolls to the drawing").toHaveBeenCalled());
    } finally {
      vi.restoreAllMocks();
      // @ts-expect-error remove the stand-in so other tests see jsdom's own (missing) method
      delete Element.prototype.scrollIntoView;
    }
  });
});
