import { appTitle } from "@/lib/bundle";
import { HOSTED_STORAGE_MAX } from "@/lib/share";

// The storage stand-in for a finished app that runs in a sealed (opaque-origin) page. Such a page has no real
// localStorage, so an app that touches it would crash. This gives it an in-memory one first: the app works and
// nothing is kept after the page closes.
//
// public/preview/frame.html carries the same code for the on-page preview (it is a plain inline script in a file the
// browser loads, so it cannot import this). tests/previewShim.test.ts checks the two stay identical.
//
// A hosted link (/a/<id>) is different: its app keeps its data on the visitor's device through the wrapper page
// (public/app-bridge.js), so it is served by hostedAppPage below instead.

export const STORAGE_SHIM_CODE = `var data = new Map();
  var store = {
    getItem: function (k) { k = String(k); return data.has(k) ? data.get(k) : null; },
    setItem: function (k, v) { data.set(String(k), String(v)); },
    removeItem: function (k) { data.delete(String(k)); },
    clear: function () { data.clear(); },
    key: function (i) { return Array.from(data.keys())[i] ?? null; },
    get length() { return data.size; }
  };
  try { Object.defineProperty(window, "localStorage", { value: store, configurable: true }); } catch (e) {}
  try { Object.defineProperty(window, "sessionStorage", { value: store, configurable: true }); } catch (e) {}`;

// What the sealed app page of a hosted link does, as plain browser code (String.raw keeps its backslashes).
// 1. Asks the wrapper page around it (its parent) for the app's saved data, and waits for the answer. A storage call in
//    an app is synchronous, so the app must not start before the data is there.
// 2. Writes the app into itself, with a storage object that starts from that data and tells the wrapper about every
//    change. The wrapper (our own code) keeps it in the real localStorage under this link's own prefix.
// 3. If the wrapper never answers (about 8 seconds), starts the app with a memory-only store, as before.
// The page has an opaque origin and no network: all it can do is talk to its parent by postMessage.
const LOADER = String.raw`(function () {
  "use strict";
  var APP = __APP__;
  var TITLE = __TITLE__;
  var MAX = __MAX__;
  var started = false;
  var retry = 0;
  var giveUp = 0;

  // Runs inside the app's own page (its source is copied there), before any of the app's scripts.
  function shim(init, persist, max) {
    function make(start, save) {
      var data = new Map();
      var size = 0;
      Object.keys(start).forEach(function (k) {
        var v = String(start[k]);
        data.set(k, v);
        size += k.length + v.length;
      });
      function tell(m) {
        if (!save) return;
        try { parent.postMessage(m, "*"); } catch (e) {}
      }
      return {
        getItem: function (k) { k = String(k); return data.has(k) ? data.get(k) : null; },
        setItem: function (k, v) {
          k = String(k); v = String(v);
          var next = size - (data.has(k) ? k.length + data.get(k).length : 0) + k.length + v.length;
          if (next > max) throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
          data.set(k, v);
          size = next;
          tell({ type: "hosted-set", key: k, value: v });
        },
        removeItem: function (k) {
          k = String(k);
          if (!data.has(k)) return;
          size -= k.length + data.get(k).length;
          data.delete(k);
          tell({ type: "hosted-remove", key: k });
        },
        clear: function () { data.clear(); size = 0; tell({ type: "hosted-clear" }); },
        key: function (i) { var ks = Array.from(data.keys()); return i >= 0 && i < ks.length ? ks[i] : null; },
        get length() { return data.size; }
      };
    }
    try { Object.defineProperty(window, "localStorage", { value: make(init, persist), configurable: true }); } catch (e) {}
    try { Object.defineProperty(window, "sessionStorage", { value: make({}, false), configurable: true }); } catch (e) {}
  }

  function escapeJson(json) {
    return json
      .replace(/</g, "\\u003c")
      .split(String.fromCharCode(8232))
      .join("\\u2028")
      .split(String.fromCharCode(8233))
      .join("\\u2029");
  }

  function withShim(html, items, persist) {
    var src = "(" + shim.toString() + ")(" + escapeJson(JSON.stringify(items)) + "," + (persist ? "true" : "false") + "," + MAX + ");";
    var tag = "<script>" + src + "<\/script>";
    var head = /<head\b[^>]*>/i.exec(html);
    if (head) return html.slice(0, head.index + head[0].length) + tag + html.slice(head.index + head[0].length);
    var doctype = /^\s*<!doctype[^>]*>/i.exec(html);
    var at = doctype ? doctype[0].length : 0;
    return html.slice(0, at) + tag + html.slice(at);
  }

  function begin(items, persist) {
    if (started) return;
    started = true;
    clearInterval(retry);
    clearTimeout(giveUp);
    var clean = Object.create(null);
    if (items && typeof items === "object") {
      Object.keys(items).forEach(function (k) { if (typeof items[k] === "string") clean[k] = items[k]; });
    }
    document.open();
    document.write(withShim(APP, clean, persist));
    document.close();
  }

  window.addEventListener("message", function (e) {
    if (e.source !== parent || !e.data || e.data.type !== "hosted-storage") return;
    begin(e.data.items, true);
  });

  function hello() {
    try { parent.postMessage({ type: "hosted-hello", title: TITLE }, "*"); } catch (e) {}
  }
  hello();
  retry = setInterval(hello, 300); // the wrapper's script may not be listening yet on the first try
  giveUp = setTimeout(function () { begin({}, false); }, 8000);
})();`;

/** `<` is escaped so a string can never close the script it sits in; the two line separators break old parsers. */
function scriptJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .split(String.fromCharCode(8232))
    .join("\\u2028")
    .split(String.fromCharCode(8233))
    .join("\\u2029");
}

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * The page a hosted link's frame loads: a small loader that starts the app once the wrapper page has sent the app's
 * saved data (see LOADER). The app's html is inside the page as a string, so the content check that ran on it still
 * describes exactly what runs.
 */
export function hostedAppPage(html: string): string {
  const title = appTitle(html);
  // One pass, so text inside the app that looks like a placeholder is never replaced.
  const values: Record<string, string> = {
    APP: scriptJson(html),
    TITLE: scriptJson(title),
    MAX: String(HOSTED_STORAGE_MAX),
  };
  const script = LOADER.replace(/__(APP|TITLE|MAX)__/g, (_m, key: string) => values[key]);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title></head><body><p style="font:14px system-ui,sans-serif;color:#555;padding:16px">Opening the app…</p><script>${script}</script></body></html>`;
}
