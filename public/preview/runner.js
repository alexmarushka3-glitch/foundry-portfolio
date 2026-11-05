// Shows a finished app (one self-contained .html file) inside a sandboxed iframe, in the visitor's own browser.
//
// The iframe is sandboxed (an opaque origin), so the app cannot reach the site's cookies or storage, and its
// Content-Security-Policy (next.config.ts) lets it make no network requests. An opaque origin has no localStorage,
// so this script gives the app an in-memory one first: the app works, and nothing is kept after the frame closes.
// The saved file has no stand-in and uses the browser's real storage.
"use strict";

(() => {
  const say = (type, message) => parent.postMessage({ type, message }, "*");

  const SHIM = `<script>(function () {
  var data = new Map();
  var store = {
    getItem: function (k) { k = String(k); return data.has(k) ? data.get(k) : null; },
    setItem: function (k, v) { data.set(String(k), String(v)); },
    removeItem: function (k) { data.delete(String(k)); },
    clear: function () { data.clear(); },
    key: function (i) { return Array.from(data.keys())[i] ?? null; },
    get length() { return data.size; }
  };
  try { Object.defineProperty(window, "localStorage", { value: store, configurable: true }); } catch (e) {}
  try { Object.defineProperty(window, "sessionStorage", { value: store, configurable: true }); } catch (e) {}
  window.addEventListener("error", function (e) { parent.postMessage({ type: "preview-error", message: String(e.message || e) }, "*"); });
})();<\/script>`;

  /** Put the storage stand-in first, so it exists before any of the app's own scripts run. */
  function withShim(html) {
    const head = /<head\b[^>]*>/i.exec(html);
    if (head) return html.slice(0, head.index + head[0].length) + SHIM + html.slice(head.index + head[0].length);
    return SHIM + html;
  }

  let started = false;
  window.addEventListener("message", (e) => {
    if (e.source !== parent || started || !e.data || e.data.type !== "preview-start" || typeof e.data.html !== "string") return;
    started = true;
    try {
      document.open();
      document.write(withShim(e.data.html));
      document.close();
      say("preview-ready");
    } catch (err) {
      say("preview-error", err && err.message ? err.message : String(err));
    }
  });

  say("preview-loaded");
})();
