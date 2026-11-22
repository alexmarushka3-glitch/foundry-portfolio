// The bridge on a hosted app link (/a/<id>). It runs in the wrapper page, which is the site's own code. The app itself
// runs in a sealed frame with no storage of its own, so it asks this script to keep and return its data. Only that
// frame is listened to, every key carries this link's id (one app cannot reach another's data or the site's), and one
// app keeps at most 256 KB. The app never gets cookies, other storage or a network.
(function () {
  "use strict";
  var match = /^\/a\/([A-Za-z0-9_-]{22})\/?$/.exec(location.pathname);
  if (!match) return;
  var PREFIX = "foundry:app:" + match[1] + ":";
  var MAX = 256 * 1024; // keys and values together, in characters (keep equal to HOSTED_STORAGE_MAX in lib/share.ts)
  var MAX_KEY = 256;

  function storage() {
    try {
      return window.localStorage;
    } catch (e) {
      return null; // blocked (private mode, site data off): the app still runs, it just keeps nothing
    }
  }

  function mine(ls) {
    // no prototype: a key named __proto__ must be counted and kept like any other, not silently dropped
    var out = Object.create(null);
    for (var i = 0; i < ls.length; i++) {
      var k = ls.key(i);
      if (k && k.indexOf(PREFIX) === 0) out[k.slice(PREFIX.length)] = ls.getItem(k) || "";
    }
    return out;
  }

  function total(items) {
    var n = 0;
    for (var k in items) n += k.length + items[k].length;
    return n;
  }

  window.addEventListener("message", function (e) {
    var frame = document.querySelector("iframe");
    if (!frame || e.source !== frame.contentWindow) return;
    var d = e.data;
    if (!d || typeof d.type !== "string") return;
    var ls = storage();

    if (d.type === "hosted-hello") {
      if (typeof d.title === "string") {
        var title = d.title.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 60);
        if (title) document.title = title;
      }
      var items = Object.create(null);
      try {
        if (ls) items = mine(ls);
      } catch (err) {}
      frame.contentWindow.postMessage({ type: "hosted-storage", items: items }, "*");
      return;
    }
    if (!ls) return;
    try {
      if (d.type === "hosted-set") {
        if (typeof d.key !== "string" || typeof d.value !== "string" || d.key.length > MAX_KEY) return;
        var all = mine(ls);
        all[d.key] = d.value;
        if (total(all) > MAX) return; // the app's own copy refuses first; this is the second lock
        ls.setItem(PREFIX + d.key, d.value);
      } else if (d.type === "hosted-remove") {
        if (typeof d.key === "string") ls.removeItem(PREFIX + d.key);
      } else if (d.type === "hosted-clear") {
        var all2 = mine(ls);
        for (var k in all2) ls.removeItem(PREFIX + k);
      }
    } catch (err) {
      // storage full or blocked: nothing more to do
    }
  });
})();
