import type { AgentName } from "../types";

// Scripted output so the demo works with no API key. Round 1 fails a browser flow so
// visitors see work get sent back, then round 2 passes and the Validator approves.
// This is labelled "Simulated" everywhere it is shown. It is never presented as model output.

const lines = (...l: string[]) => l.join("\n");

export function simulate(agent: AgentName, round: number, request: string): string {
  const topic = request.length > 60 ? request.slice(0, 57) + "..." : request;
  const firstRound = round === 1;
  switch (agent) {
    case "researcher":
      return lines(
        "- index.html: a page with one h1; loads style.css, app.js and ui.js",
        "- app.js: loadData and saveData keep data in the browser's storage",
        "- style.css: a clean base for inputs, buttons and cards",
        "- tests/app.test.js: one unit test, run with node --test",
        `Needs: inputs, a results area and saved data for "${topic}".`,
      );
    case "story":
      return lines(
        `As a visitor, I want ${topic.charAt(0).toLowerCase()}${topic.slice(1)} so that I can use it on my own device.`,
        "1. I can enter what the app needs and see the result straight away.",
        "2. Bad or empty input shows a friendly message.",
        "3. My data is still there when I open the app again.",
      );
    case "pm":
      return lines(
        "Logic: app.js gets the calculation and list functions, saved with saveData.",
        "Page: a labelled input per value, an Add button, a results list with an empty state.",
        "Tests: the calculation, bad input, and saving and loading.",
      );
    case "backend":
      return firstRound
        ? lines(
            "```js",
            "function addItem(items, text) { return [...items, { text }]; }",
            "```",
            "Notes: added the list logic; empty text not handled yet.",
          )
        : lines(
            "```js",
            "function addItem(items, text) {",
            "  if (!text.trim()) throw new Error('Type something first.');",
            "  return [...items, { text: text.trim() }];",
            "}",
            "```",
            "Notes: empty input now rejected, as the failed flow asked.",
          );
    case "frontend":
      return firstRound
        ? lines(
            "```html",
            '<label for="item">New item</label><input id="item" /><button id="add">Add</button>',
            "```",
            "Notes: page wired up; no error message yet.",
          )
        : lines(
            "```html",
            '<p id="error" role="alert"></p>',
            "```",
            "Notes: shows the error message from app.js.",
          );
    case "e2e":
      return lines(
        firstRound ? "E2E: FAIL" : "E2E: PASS",
        "Flow 1, add an item and see it listed: PASS",
        "Flow 2, reload and the item is still there: PASS",
        `Flow 3, press Add with nothing typed: ${firstRound ? "FAIL (no message shown)" : "PASS"}`,
      );
    case "validator":
      return lines(
        "VERDICT: APPROVE",
        "- Criteria 1 to 3 met; flows all pass.",
        "- No network requests; data stays in the browser.",
      );
    case "release":
      return lines(
        `${topic}`,
        "- Type in the box and press Add.",
        "- Bad input shows a message instead of breaking.",
        "It saves on your own device.",
      );
  }
}
