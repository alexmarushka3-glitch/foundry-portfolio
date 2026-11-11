// The storage stand-in for a finished app that runs in a sealed (opaque-origin) page. Such a page has no real
// localStorage, so an app that touches it would crash. This gives it an in-memory one first: the app works and
// nothing is kept after the page closes.
//
// public/preview/runner.js carries the same code for the on-page preview (it is a plain file the browser loads, so
// it cannot import this). tests/previewShim.test.ts checks the two stay identical.

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

const HOSTED_SHIM = `<script>(function () {\n  ${STORAGE_SHIM_CODE}\n})();</script>`;

/** Puts the storage stand-in first, so it exists before any of the app's own scripts run. */
export function withHostedShim(html: string): string {
  const head = /<head\b[^>]*>/i.exec(html);
  if (!head) {
    // Keep a leading doctype first: anything before it puts the page into quirks mode.
    const doctype = /^\s*<!doctype[^>]*>/i.exec(html);
    const at = doctype ? doctype[0].length : 0;
    return html.slice(0, at) + HOSTED_SHIM + html.slice(at);
  }
  const end = head.index + head[0].length;
  return html.slice(0, end) + HOSTED_SHIM + html.slice(end);
}
