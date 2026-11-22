import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

// public/preview/frame.html runs a finished app inside the sealed preview frame and tells the page around it what
// happened. These tests run the real file in a fake browser, where the page around it is the window itself.

const FRAME = readFileSync("public/preview/frame.html", "utf8");

type Posted = { type: string; fatal?: boolean; message?: string };

async function runApp(appHtml: string) {
  const posted: Posted[] = [];
  const dom = new JSDOM(FRAME, {
    runScripts: "dangerously",
    url: "https://foundry.test/preview/frame.html",
    beforeParse(window: { postMessage: (m: Posted) => void }) {
      window.postMessage = (m) => void posted.push(m); // the frame talks to its parent, which here is the window itself
    },
  });
  const w = dom.window;
  expect(posted.map((p) => p.type)).toEqual(["preview-loaded"]);
  w.dispatchEvent(
    new w.MessageEvent("message", {
      data: { type: "preview-start", html: appHtml },
      source: w.parent,
    }),
  );
  await new Promise((resolve) => setTimeout(resolve, 100)); // lets the page finish loading
  return { dom, posted };
}

describe("preview frame errors", () => {
  it("reports an app whose script throws as it starts as a fatal error, so the failure is shown", async () => {
    const { posted } = await runApp(
      '<!doctype html><html><head></head><body><script>throw new Error("boom at start");</script></body></html>',
    );
    const error = posted.find((p) => p.type === "preview-error");
    expect(error?.fatal).toBe(true);
    expect(error?.message).toContain("boom at start");
  });

  it("reports an error after the app has loaded (a click handler) as not fatal, because the app keeps running", async () => {
    const { dom, posted } = await runApp(
      '<!doctype html><html><head></head><body><button id="b" onclick="throw new Error(\'late boom\')">x</button></body></html>',
    );
    expect(posted.find((p) => p.type === "preview-error")).toBeUndefined(); // started cleanly
    dom.window.document.getElementById("b")!.click();
    const error = posted.find((p) => p.type === "preview-error");
    expect(error?.fatal).toBe(false);
    expect(error?.message).toContain("late boom");
  });

  it("counts an app that starts inside its own load or DOMContentLoaded handler as starting, so a throw there is fatal", async () => {
    for (const handler of [
      'window.addEventListener("load", function () { throw new Error("boom in load"); });',
      'document.addEventListener("DOMContentLoaded", function () { throw new Error("boom in ready"); });',
      "window.onload = function () { throw new Error('boom in onload'); };",
    ]) {
      const { posted } = await runApp(
        `<!doctype html><html><head></head><body><script>${handler}</script></body></html>`,
      );
      const error = posted.find((p) => p.type === "preview-error");
      expect(error?.fatal, handler).toBe(true);
    }
  });

  it("reports a timer that throws well after the app started as not fatal", async () => {
    const { posted } = await runApp(
      '<!doctype html><html><head></head><body><script>setTimeout(function () { throw new Error("late tick"); }, 50);</script></body></html>',
    );
    await new Promise((resolve) => setTimeout(resolve, 200));
    const error = posted.find((p) => p.type === "preview-error");
    expect(error?.message).toContain("late tick");
    expect(error?.fatal).toBe(false);
  });

  it("says ready for an app that starts cleanly, with no error", async () => {
    const { posted } = await runApp(
      "<!doctype html><html><head></head><body><h1>Fine</h1></body></html>",
    );
    expect(posted.map((p) => p.type)).toEqual(["preview-loaded", "preview-ready"]);
  });
});
