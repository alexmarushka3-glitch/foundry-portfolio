// The starter kit every run begins from: a tiny one-page web app the agents fill in. It runs in a browser with no
// server and no internet, and the finished files are bundled into one .html file (lib/bundle.ts) that the visitor
// can use on the page or save. Browser and server safe.

export const STARTER_FILES: Record<string, string> = {
  "README.md": `# Starter kit

One small web app that runs in a browser with no server and no internet. When it is done, the four app files are
put together into one .html file that people open in their browser.

- index.html: the page. Keep the stylesheet link and the two script tags, in that order.
- style.css: the look. A clean base is already there; build on it.
- app.js: the logic and the data. No page (DOM) code. Plain functions. Save data with loadData and saveData.
  Keep the export line at the bottom, listing every function ui.js or the tests use.
- ui.js: connects the page to app.js: reads inputs, calls app.js functions, shows the results.
- tests/app.test.js: unit tests for app.js, run with node --test.

Rules: no external scripts, fonts, images or network requests. No eval. Every input needs a visible label.
The page must have one h1. It must work offline, saved as a single file.
`,

  "index.html": `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>My app</title>
    <link rel="stylesheet" href="style.css" />
  </head>
  <body>
    <main id="app">
      <h1>My app</h1>
    </main>
    <script src="app.js"></script>
    <script src="ui.js"></script>
  </body>
</html>
`,

  "style.css": `* { box-sizing: border-box; }
body { margin: 0; font: 16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; color: #1d232a; background: #f6f7f8; }
main { max-width: 560px; margin: 0 auto; padding: 24px 16px 48px; }
h1 { font-size: 1.6rem; margin: 0 0 16px; }
label { display: block; font-weight: 600; margin: 12px 0 4px; }
input, select, textarea, button { font: inherit; }
input, select, textarea { width: 100%; padding: 8px 10px; border: 1px solid #9aa4ad; border-radius: 8px; background: #fff; }
button { padding: 8px 14px; border: 0; border-radius: 8px; background: #1f6f63; color: #fff; cursor: pointer; }
button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible { outline: 3px solid #f0a23a; outline-offset: 2px; }
.card { background: #fff; border: 1px solid #dde1e4; border-radius: 12px; padding: 16px; margin: 12px 0; }
`,

  "app.js": `// The app's logic and data. No page code here: ui.js uses these functions and tests/app.test.js tests them.

const STORAGE_KEY = "foundry-app";

/** Read saved data, or return the fallback when nothing is saved (or storage is unavailable). */
function loadData(fallback) {
  try {
    const raw = globalThis.localStorage && globalThis.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

/** Save data so it is still there next time the app is opened. */
function saveData(data) {
  try {
    if (globalThis.localStorage) globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // storage full or blocked: the app keeps working, it just won't remember
  }
}

// Keep this line last. List every function ui.js or the tests use.
if (typeof module !== "undefined") module.exports = { loadData, saveData };
`,

  "ui.js": `// Connects the page (index.html) to the logic in app.js.
`,

  "tests/app.test.js": `const test = require("node:test");
const assert = require("node:assert/strict");
const app = require("../app.js");

test("loadData returns the fallback when nothing is saved", () => {
  assert.deepEqual(app.loadData([]), []);
});
`,

  "package.json": `{
  "name": "foundry-app",
  "private": true,
  "scripts": {
    "test": "node --test tests/*.test.js"
  }
}
`,
};

/** Where each engineer may write. Everything else (README, package.json) is fixed. */
export const LOGIC_FILES = /^(app\.js|tests\/[\w.-]+\.test\.js)$/;
export const INTERFACE_FILES = /^(index\.html|style\.css|ui\.js)$/;
