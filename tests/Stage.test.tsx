// @vitest-environment jsdom
import { cleanup, configure, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Stage from "@/components/Stage";
import { encodeEvent } from "@/lib/ndjson";
import type { FoundryEvent } from "@/lib/types";
import { FIXTURE_REQUEST, fixtureRecording } from "./fixtures/liveRecording";

// Each test renders a whole run. Right after a browser test the machine can be busy, and the default one-second wait
// for a run to show up is tight; the races that once made these tests flaky are fixed, so this only allows for load.
configure({ asyncUtilTimeout: 4000 });

vi.mock("@/lib/liveRecordings.json", () => ({ default: { recordings: [] } }));
/** Set `hold` to a promise to make recordings load slowly, the way a real fetch does. */
const loading = vi.hoisted(() => ({ hold: null as Promise<void> | null }));
vi.mock("@/lib/liveReplay", async (orig) => {
  const mod = await orig<typeof import("@/lib/liveReplay")>();
  const { fixtureRecording } = await import("./fixtures/liveRecording");
  const rec = fixtureRecording();
  return {
    ...mod,
    loadLiveRecording: async (request: string) => {
      if (loading.hold) await loading.hold;
      return mod.findLiveRecording([rec], request);
    },
  };
});
vi.mock("@/lib/exampleRequests", () => ({
  EXAMPLE_REQUESTS: ["Let users set a due date on tasks"],
}));

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
  loading.hold = null;
  cleanup();
  vi.unstubAllGlobals();
});

const ndjson = (events: FoundryEvent[]) =>
  new Response(events.map(encodeEvent).join(""), {
    headers: { "content-type": "application/x-ndjson" },
  });

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
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: true,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      })),
    );
    class IO {
      constructor(private cb: (e: unknown[]) => void) {}
      observe() {
        this.cb([
          { isIntersecting: true, intersectionRatio: 1, intersectionRect: { height: 9999 } },
        ]);
      }
      disconnect() {}
    }
    vi.stubGlobal("IntersectionObserver", IO);
    mockApi(() => ndjson([]));
    render(<Stage />);
    expect(await screen.findByText("Run finished.")).toBeTruthy();
    expect(screen.getByText("Replay of a real live run")).toBeTruthy();
  });

  it("does not let the autoplay example take over when the visitor typed an idea while it was loading", async () => {
    class IO {
      constructor(private cb: (e: unknown[]) => void) {}
      observe() {
        this.cb([
          { isIntersecting: true, intersectionRatio: 1, intersectionRect: { height: 9999 } },
        ]);
      }
      disconnect() {}
    }
    vi.stubGlobal("IntersectionObserver", IO);
    let release!: () => void;
    loading.hold = new Promise<void>((r) => (release = r));
    mockApi(() => ndjson(simulatedRun));
    render(<Stage />);
    typeIdea();
    release();
    expect(await screen.findByText(/This was scripted text, so no model ran/)).toBeTruthy();
    expect(screen.queryByText("Replay of a real live run")).toBeNull();
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
        {
          type: "files",
          files: {
            "index.html":
              "<!doctype html><html><head><title>Tip calculator</title></head><body><h1>Tip calculator</h1></body></html>",
          },
        },
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

  describe("ways to keep or open a finished app", () => {
    /** jsdom has no object URLs; this stands in for them so a test can tell whether a download started. */
    const realUrl = { create: URL.createObjectURL, revoke: URL.revokeObjectURL };
    afterEach(() => {
      URL.createObjectURL = realUrl.create;
      URL.revokeObjectURL = realUrl.revoke;
      delete (navigator as unknown as { clipboard?: unknown }).clipboard;
    });
    const stubObjectUrl = () => {
      const created = vi.fn(() => "blob:test");
      URL.createObjectURL = created;
      URL.revokeObjectURL = vi.fn();
      return created;
    };
    /** Let promises that are already settled run their callbacks before the test looks. */
    const settle = () => new Promise((r) => setTimeout(r, 0));
    const approvedRun: FoundryEvent[] = [
      { type: "mode", mode: "live" },
      { type: "start", agent: "researcher", round: 1, model: "m" },
      { type: "done", agent: "researcher", round: 1, ms: 20 },
      {
        type: "files",
        sig: "f".repeat(64),
        files: {
          "index.html":
            "<!doctype html><html><head><title>Tip calculator</title></head><body><h1>Tip calculator</h1></body></html>",
        },
      },
      { type: "finish", ms: 100, rounds: 1, approved: true },
    ];

    it("saves through the Save as window when the browser has one, with no download", async () => {
      const write = vi.fn(async () => {});
      const close = vi.fn(async () => {});
      const picker = vi.fn(async () => ({ createWritable: async () => ({ write, close }) }));
      vi.stubGlobal("showSaveFilePicker", picker);
      const created = stubObjectUrl();
      mockApi(() => ndjson(approvedRun));
      render(<Stage />);
      typeIdea();
      fireEvent.click(await screen.findByRole("button", { name: "Save the app" }));
      await waitFor(() => expect(close).toHaveBeenCalled());
      expect(picker).toHaveBeenCalledWith(
        expect.objectContaining({ suggestedName: "tip-calculator.html" }),
      );
      expect(String((write.mock.calls[0] as unknown[])[0])).toContain("<h1>Tip calculator</h1>");
      expect(created).not.toHaveBeenCalled();
      expect(await screen.findByText("Saved.")).toBeTruthy();
    });

    it("does nothing more when the visitor closes the Save as window", async () => {
      const picker = vi.fn(async () => {
        throw Object.assign(new Error("closed"), { name: "AbortError" });
      });
      vi.stubGlobal("showSaveFilePicker", picker);
      const created = stubObjectUrl();
      mockApi(() => ndjson(approvedRun));
      render(<Stage />);
      typeIdea();
      fireEvent.click(await screen.findByRole("button", { name: "Save the app" }));
      await waitFor(() => expect(picker).toHaveBeenCalled());
      await settle();
      expect(created).not.toHaveBeenCalled();
      expect(screen.queryByText(/Download started/)).toBeNull();
    });

    it("downloads instead when the Save as window is refused, and says so", async () => {
      const picker = vi.fn(async () => {
        throw Object.assign(new Error("blocked"), { name: "SecurityError" });
      });
      vi.stubGlobal("showSaveFilePicker", picker);
      const created = stubObjectUrl();
      vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
      mockApi(() => ndjson(approvedRun));
      render(<Stage />);
      typeIdea();
      fireEvent.click(await screen.findByRole("button", { name: "Save the app" }));
      await waitFor(() => expect(created).toHaveBeenCalled());
      expect(await screen.findByText(/Download started/)).toBeTruthy();
    });

    it("does not also download when the file was chosen but could not be written", async () => {
      const picker = vi.fn(async () => ({
        createWritable: async () => {
          throw new Error("disk full");
        },
      }));
      vi.stubGlobal("showSaveFilePicker", picker);
      const created = stubObjectUrl();
      mockApi(() => ndjson(approvedRun));
      render(<Stage />);
      typeIdea();
      fireEvent.click(await screen.findByRole("button", { name: "Save the app" }));
      expect(await screen.findByText(/could not be written/)).toBeTruthy();
      expect(created).not.toHaveBeenCalled();
    });

    it("falls back to a normal download when there is no Save as window", async () => {
      vi.stubGlobal("showSaveFilePicker", undefined);
      const created = stubObjectUrl();
      vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
      mockApi(() => ndjson(approvedRun));
      render(<Stage />);
      typeIdea();
      fireEvent.click(await screen.findByRole("button", { name: "Save the app" }));
      await waitFor(() => expect(created).toHaveBeenCalled());
    });

    it("copies the whole page to the clipboard and says what to do with it", async () => {
      const writeText = vi.fn(async () => {});
      Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
      mockApi(() => ndjson(approvedRun));
      render(<Stage />);
      typeIdea();
      fireEvent.click(await screen.findByRole("button", { name: "Copy the code" }));
      await waitFor(() => expect(writeText).toHaveBeenCalled());
      expect(String((writeText.mock.calls[0] as unknown[])[0])).toContain("Tip calculator");
      expect(await screen.findByText(/name the file app\.html/)).toBeTruthy();
    });

    it("opens the app full screen in a new tab and hands it the page when that tab asks", async () => {
      const tab = { postMessage: vi.fn() };
      const open = vi.fn(() => tab);
      vi.stubGlobal("open", open);
      mockApi(() => ndjson(approvedRun));
      render(<Stage />);
      typeIdea();
      fireEvent.click(await screen.findByRole("button", { name: "Open full screen" }));
      expect(open).toHaveBeenCalledWith("/preview/full.html", "_blank");
      const ask = (source?: Window) =>
        window.dispatchEvent(
          new MessageEvent("message", {
            data: { type: "full-loaded" },
            origin: window.location.origin,
            source,
          }),
        );
      // The page listens from a passive effect that can lag a moment behind what the test sees, so ask until it answers.
      await waitFor(() => {
        ask(tab as unknown as Window);
        expect(tab.postMessage).toHaveBeenCalledWith(
          expect.objectContaining({ type: "full-start", title: "Tip calculator" }),
          window.location.origin,
        );
      });
      // a message from some other window is ignored
      const answered = tab.postMessage.mock.calls.length;
      ask();
      expect(tab.postMessage.mock.calls.length).toBe(answered);
    });

    /** Answers /api/share the way the server would, and the run itself with the approved run. */
    const mockShare = (share: { available: boolean; post?: () => Response }) => {
      const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
        if (url === "/api/share")
          return init?.method === "POST"
            ? share.post!()
            : Response.json({ available: share.available });
        return init?.method === "POST" ? ndjson(approvedRun) : Response.json({ live: false });
      });
      vi.stubGlobal("fetch", fetchMock);
      return fetchMock;
    };

    it("hides Get a link when the server cannot keep links", async () => {
      mockShare({ available: false });
      render(<Stage />);
      typeIdea();
      await screen.findByRole("button", { name: "Save the app" });
      expect(screen.queryByRole("button", { name: "Get a link" })).toBeNull();
    });

    it("makes a link, shows it with how long it lasts, and copies it", async () => {
      const writeText = vi.fn(async () => {});
      Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
      const fetchMock = mockShare({
        available: true,
        post: () => Response.json({ id: "x", url: "https://site.test/a/abc", expiresAt: "later" }),
      });
      render(<Stage />);
      typeIdea();
      const getLink = await screen.findByRole("button", { name: "Get a link" });
      fireEvent.click(getLink);
      fireEvent.click(getLink); // a second click while it works must not make a second link
      const input = (await screen.findByLabelText("Your link")) as HTMLInputElement;
      expect(input.value).toBe("https://site.test/a/abc");
      expect(
        screen.getByText(/open the app in a browser for 7 days, then it is deleted/),
      ).toBeTruthy();
      const post = fetchMock.mock.calls.find(
        ([url, init]) => url === "/api/share" && init?.method === "POST",
      )!;
      const sent = JSON.parse(String(post[1]!.body));
      expect(sent.files["index.html"]).toContain("<h1>Tip calculator</h1>");
      expect(sent.sig).toBe("f".repeat(64)); // the signature the server put on the run's files event
      expect(sent.html).toBeUndefined();
      const posts = fetchMock.mock.calls.filter(
        ([url, init]) => url === "/api/share" && init?.method === "POST",
      );
      expect(posts).toHaveLength(1);
      // with a link already made, the button cannot make another copy
      expect(screen.getByRole("button", { name: "Get a link" }).hasAttribute("disabled")).toBe(
        true,
      );
      fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
      await waitFor(() => expect(writeText).toHaveBeenCalledWith("https://site.test/a/abc"));
      expect(await screen.findByText("Link copied.")).toBeTruthy();
    });

    it("shows why a link was refused, makes no link, and leaves the other ways to keep the app", async () => {
      mockShare({
        available: true,
        post: () =>
          Response.json(
            {
              error:
                "This app can't get a link because it asks for a password. You can still save it.",
            },
            { status: 422 },
          ),
      });
      render(<Stage />);
      typeIdea();
      fireEvent.click(await screen.findByRole("button", { name: "Get a link" }));
      expect(
        await screen.findByText(/can't get a link because it asks for a password/),
      ).toBeTruthy();
      expect(screen.queryByLabelText("Your link")).toBeNull();
      expect(screen.getByRole("button", { name: "Save the app" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Get a link" })).toBeTruthy(); // not stuck on "Making a link"
    });

    it("keeps Copy the code available when the new tab is blocked", async () => {
      vi.stubGlobal(
        "open",
        vi.fn(() => null),
      );
      mockApi(() => ndjson(approvedRun));
      render(<Stage />);
      typeIdea();
      fireEvent.click(await screen.findByRole("button", { name: "Open full screen" }));
      expect(await screen.findByText(/blocked the new tab/)).toBeTruthy();
      expect(screen.getByRole("button", { name: "Copy the code" })).toBeTruthy();
    });

    it("offers none of these after a simulation", async () => {
      mockApi(() => ndjson(simulatedRun));
      render(<Stage />);
      typeIdea();
      expect(await screen.findByText(/This was scripted text/)).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Open full screen" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Copy the code" })).toBeNull();
    });
  });

  it("shows the server's error and lets the visitor try again (the button must not stay stuck)", async () => {
    mockApi(() =>
      ndjson([
        { type: "mode", mode: "live" },
        { type: "error", message: "The run stopped before it finished." },
      ]),
    );
    render(<Stage />);
    typeIdea();

    expect((await screen.findByRole("alert")).textContent).toContain(
      "The run stopped before it finished.",
    );
    const run = screen.getByRole("button", { name: "Build it" }) as HTMLButtonElement;
    await waitFor(() => expect(run.disabled).toBe(false));
  });

  it("recovers when the connection drops before the run finishes", async () => {
    mockApi(() =>
      ndjson([
        { type: "mode", mode: "simulated" },
        { type: "start", agent: "researcher", round: 1, model: "m" },
      ]),
    );
    render(<Stage />);
    typeIdea();

    expect((await screen.findByRole("alert")).textContent).toMatch(/ended before it finished/);
    expect((screen.getByRole("button", { name: "Build it" }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it("shows the message from a rejected request", async () => {
    mockApi(() => Response.json({ error: "Keep it under 200 characters." }, { status: 400 }));
    render(<Stage />);
    typeIdea();
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Keep it under 200 characters.",
    );
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
    expect(
      await screen.findByText(/doesn't build apps that ask for logins or payment details/),
    ).toBeTruthy();
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
    await waitFor(() =>
      expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1),
    );
  });
});
