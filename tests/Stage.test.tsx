// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Stage from "@/components/Stage";
import { encodeEvent } from "@/lib/ndjson";
import type { FoundryEvent } from "@/lib/types";
import { FIXTURE_REQUEST, fixtureRecording } from "./fixtures/liveRecording";

vi.mock("@/lib/liveRecordings.json", () => ({ default: { recordings: [] } }));
vi.mock("@/lib/liveReplay", async (orig) => {
  const mod = await orig<typeof import("@/lib/liveReplay")>();
  const { fixtureRecording } = await import("./fixtures/liveRecording");
  const rec = fixtureRecording();
  return { ...mod, loadLiveRecording: async (request: string) => mod.findLiveRecording([rec], request) };
});
vi.mock("@/lib/exampleRequests", () => ({ EXAMPLE_REQUESTS: ["Let users set a due date on tasks"] }));

// jsdom has no matchMedia, and the stage's replays should not animate in these tests.
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

const ndjson = (events: FoundryEvent[]) =>
  new Response(events.map(encodeEvent).join(""), { headers: { "content-type": "application/x-ndjson" } });

/** GET /api/run says live is off; POST /api/run answers with `post`. */
function mockApi(post: () => Response | Promise<Response>) {
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
    init?.method === "POST" ? post() : Response.json({ live: false }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const simulatedRun: FoundryEvent[] = [
  { type: "mode", mode: "simulated" },
  { type: "start", agent: "researcher", round: 1, model: "m (simulated)" },
  { type: "token", agent: "researcher", round: 1, text: "- found the tasks table" },
  { type: "done", agent: "researcher", round: 1, ms: 20 },
  { type: "finish", ms: 100, rounds: 1, approved: true },
];

const IDEA = "A tip calculator for friends";
const typeIdea = (idea = IDEA) => {
  fireEvent.change(screen.getByLabelText(/describe your own app/i), { target: { value: idea } });
  fireEvent.click(screen.getByRole("button", { name: "Build it" }));
};

describe("Stage", () => {
  it("replays a live-run recording in the browser, with its tool lines, without calling the run API", async () => {
    const fetchMock = mockApi(() => ndjson([]));
    const { container } = render(<Stage />);
    fireEvent.click(screen.getByRole("button", { name: FIXTURE_REQUEST }));
    expect(await screen.findByText("Replay of a real live run")).toBeTruthy();
    expect(screen.getByText(/A recording of a real run, sped up/)).toBeTruthy();
    const scrub = screen.getByLabelText("Scrub through the run") as HTMLInputElement;
    fireEvent.change(scrub, { target: { value: scrub.max } });
    fireEvent.click(screen.getByRole("button", { name: /^Researcher:.*Show its output/ }));
    await waitFor(() => expect(container.textContent).toContain("› read src/db.js"));
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  });

  it("shows the first example already finished when the visitor prefers reduced motion", async () => {
    vi.stubGlobal("matchMedia", vi.fn().mockImplementation((query: string) => ({ matches: true, media: query, addEventListener: () => {}, removeEventListener: () => {} })));
    class IO {
      constructor(private cb: (e: unknown[]) => void) {}
      observe() {
        this.cb([{ isIntersecting: true, intersectionRatio: 1, intersectionRect: { height: 9999 } }]);
      }
      disconnect() {}
    }
    vi.stubGlobal("IntersectionObserver", IO);
    mockApi(() => ndjson([]));
    render(<Stage />);
    expect(await screen.findByText("Run finished.")).toBeTruthy();
    expect(screen.getByText("Replay of a real live run")).toBeTruthy();
  });

  it("offers the examples as free recordings, before the box for the visitor's own idea", async () => {
    mockApi(() => ndjson([]));
    render(<Stage />);
    expect(await screen.findByText(/Watch an example \(recorded earlier, free\)/)).toBeTruthy();
    expect(screen.getByRole("group", { name: "Examples" }).textContent).toContain(FIXTURE_REQUEST);
  });

  it("sends a typed idea to the server, labels it Simulated, and ends with a plain summary", async () => {
    const fetchMock = mockApi(() => ndjson(simulatedRun));
    render(<Stage />);
    typeIdea();

    expect(await screen.findByText("Simulated")).toBeTruthy();
    expect(await screen.findByText(/This was scripted text, so no model ran/)).toBeTruthy();
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST")!;
    expect(JSON.parse(String(post[1]!.body))).toEqual({ idea: IDEA });
    // the finished run can be scrubbed
    expect(screen.getByLabelText("Scrub through the run")).toBeTruthy();
  });

  it("shows the finished app and a save button after an approved live run, and not after a simulation", async () => {
    mockApi(() =>
      ndjson([
        { type: "mode", mode: "live" },
        { type: "start", agent: "researcher", round: 1, model: "m" },
        { type: "done", agent: "researcher", round: 1, ms: 20 },
        { type: "files", files: { "index.html": "<!doctype html><html><head><title>Tip calculator</title></head><body><h1>Tip calculator</h1></body></html>" } },
        { type: "finish", ms: 100, rounds: 1, approved: true },
      ]),
    );
    render(<Stage />);
    typeIdea();
    expect(await screen.findByRole("button", { name: "Save the app" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Your app: Tip calculator" })).toBeTruthy();
    const frame = screen.getByTitle("Tip calculator, running in your browser");
    expect(frame.getAttribute("sandbox")).toBe("allow-scripts allow-forms allow-modals");
    cleanup();

    mockApi(() => ndjson(simulatedRun));
    render(<Stage />);
    typeIdea();
    expect(await screen.findByText(/This was scripted text/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Save the app" })).toBeNull();
  });

  it("shows the server's error and lets the visitor try again (the button must not stay stuck)", async () => {
    mockApi(() => ndjson([{ type: "mode", mode: "live" }, { type: "error", message: "The run stopped before it finished." }]));
    render(<Stage />);
    typeIdea();

    expect((await screen.findByRole("alert")).textContent).toContain("The run stopped before it finished.");
    const run = screen.getByRole("button", { name: "Build it" }) as HTMLButtonElement;
    await waitFor(() => expect(run.disabled).toBe(false));
  });

  it("recovers when the connection drops before the run finishes", async () => {
    mockApi(() => ndjson([{ type: "mode", mode: "simulated" }, { type: "start", agent: "researcher", round: 1, model: "m" }]));
    render(<Stage />);
    typeIdea();

    expect((await screen.findByRole("alert")).textContent).toMatch(/ended before it finished/);
    expect((screen.getByRole("button", { name: "Build it" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("shows the message from a rejected request", async () => {
    mockApi(() => Response.json({ error: "Keep it under 200 characters." }, { status: 400 }));
    render(<Stage />);
    typeIdea();
    expect((await screen.findByRole("alert")).textContent).toContain("Keep it under 200 characters.");
  });

  it("says what a typed idea will do, once the server has said whether live runs are on", async () => {
    mockApi(() => ndjson([]));
    render(<Stage />);
    expect(await screen.findByText(/runs a labelled simulation/)).toBeTruthy();
  });
});

describe("the idea box", () => {
  it("says what is missing next to the box, and focuses it, instead of blocking the button", async () => {
    const fetchMock = mockApi(() => ndjson([]));
    render(<Stage />);
    const build = screen.getByRole("button", { name: "Build it" }) as HTMLButtonElement;
    expect(build.disabled).toBe(false);
    fireEvent.click(build);
    expect(await screen.findByText(/Describe the app in a few words first/)).toBeTruthy();
    const box = screen.getByLabelText(/describe your own app/i);
    expect(document.activeElement).toBe(box);
    expect(box.getAttribute("aria-invalid")).toBe("true");
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
    // typing clears the message
    fireEvent.change(box, { target: { value: IDEA } });
    expect(screen.queryByText(/Describe the app in a few words first/)).toBeNull();
  });

  it("turns down login and payment apps in the browser, before anything is sent", async () => {
    const fetchMock = mockApi(() => ndjson([]));
    render(<Stage />);
    typeIdea("A login page that saves passwords");
    expect(await screen.findByText(/doesn't build apps that ask for logins or payment details/)).toBeTruthy();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  });

  it("submits with Enter and says a live idea runs on real models", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === "POST" ? ndjson(simulatedRun) : Response.json({ live: true }),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<Stage />);
    expect(await screen.findByText(/runs live on real AI models/)).toBeTruthy();
    const box = screen.getByLabelText(/describe your own app/i);
    fireEvent.change(box, { target: { value: IDEA } });
    fireEvent.keyDown(box, { key: "Enter" });
    await waitFor(() => expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1));
  });
});
