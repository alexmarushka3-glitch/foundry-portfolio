// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Stage from "@/components/Stage";
import { encodeEvent } from "@/lib/ndjson";
import { EXAMPLE_REQUESTS } from "@/lib/run";
import type { FoundryEvent } from "@/lib/types";

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

const typeIdea = (name: string) => {
  fireEvent.change(screen.getByLabelText(/field name/i), { target: { value: name } });
  fireEvent.click(screen.getByRole("button", { name: "Run" }));
};

describe("Stage", () => {
  it("replays a recorded example in the browser without calling the run API", async () => {
    const fetchMock = mockApi(() => ndjson([]));
    render(<Stage />);
    fireEvent.click(screen.getByRole("button", { name: EXAMPLE_REQUESTS[1] }));
    expect(await screen.findByText("Replay of a real run")).toBeTruthy();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  });

  it("sends a typed idea to the server, labels it Simulated, and ends with a plain summary", async () => {
    const fetchMock = mockApi(() => ndjson(simulatedRun));
    render(<Stage />);
    typeIdea("nickname");

    expect(await screen.findByText("Simulated")).toBeTruthy();
    expect(await screen.findByText(/This was scripted text, so no model ran/)).toBeTruthy();
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST")!;
    expect(JSON.parse(String(post[1]!.body))).toEqual({ spec: { kind: "field", name: "nickname", valueType: "date", required: false } });
    // the finished run can be scrubbed
    expect(screen.getByLabelText("Scrub through the run")).toBeTruthy();
  });

  it("shows the server's error and lets the visitor try again (the Run button must not stay stuck)", async () => {
    mockApi(() => ndjson([{ type: "mode", mode: "live" }, { type: "error", message: "The run stopped before it finished." }]));
    render(<Stage />);
    typeIdea("nickname");

    expect((await screen.findByRole("alert")).textContent).toContain("The run stopped before it finished.");
    const run = screen.getByRole("button", { name: "Run" }) as HTMLButtonElement;
    await waitFor(() => expect(run.disabled).toBe(false));
  });

  it("recovers when the connection drops before the run finishes", async () => {
    mockApi(() => ndjson([{ type: "mode", mode: "simulated" }, { type: "start", agent: "researcher", round: 1, model: "m" }]));
    render(<Stage />);
    typeIdea("nickname");

    expect((await screen.findByRole("alert")).textContent).toMatch(/ended before it finished/);
    expect((screen.getByRole("button", { name: "Run" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("shows the message from a rejected request", async () => {
    mockApi(() => Response.json({ error: "Keep it under 200 characters." }, { status: 400 }));
    render(<Stage />);
    typeIdea("nickname");
    expect((await screen.findByRole("alert")).textContent).toContain("Keep it under 200 characters.");
  });

  it("says what a typed idea will do, once the server has said whether live runs are on", async () => {
    mockApi(() => ndjson([]));
    render(<Stage />);
    expect(await screen.findByText(/runs a labelled simulation/)).toBeTruthy();
  });
});

describe("the request form", () => {
  it("says what is missing next to the name field, and focuses it, instead of blocking the Run button", async () => {
    const fetchMock = mockApi(() => ndjson([]));
    render(<Stage />);
    const run = screen.getByRole("button", { name: "Run" }) as HTMLButtonElement;
    expect(run.disabled).toBe(false);
    fireEvent.click(run);
    expect((await screen.findByText(/at least two characters/)).textContent).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText(/field name/i));
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
    // typing clears the message
    fireEvent.change(screen.getByLabelText(/field name/i), { target: { value: "nickname" } });
    expect(screen.queryByText(/at least two characters/)).toBeNull();
    expect(screen.getByText(/The agents will get:/)).toBeTruthy();
  });
});
