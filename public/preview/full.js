// Shows a finished app full screen in its own tab, in the visitor's own browser.
//
// This page holds only the site's own code. The app itself runs in the same sealed iframe the page uses
// (/preview/frame.html inside sandbox="allow-scripts allow-forms allow-modals"): an opaque origin with no cookies, no
// storage of the site, and no network. The page that opened this tab (window.opener) sends the app's html here; nothing
// is stored, so if that page is closed the tab cannot show the app again.
"use strict";

(() => {
  const frame = document.getElementById("app");
  let html = null;
  let frameReady = false;
  let sent = false;

  let shown = false;
  let stuck = false;
  let stuckTimer = 0;

  const send = () => {
    if (html === null || !frameReady || sent) return;
    sent = true;
    frame.contentWindow.postMessage({ type: "preview-start", html }, "*");
  };

  // Once the app's html is here, the frame has a few seconds to show it. If it never does (a browser that blocks the
  // frame's script, say), say so with a way out instead of leaving "Opening the app…" on screen forever.
  const stuckMessage = () => {
    if (shown || stuck) return;
    stuck = true;
    frame.remove();
    const wrap = document.createElement("div");
    wrap.style.cssText = "font: 14px system-ui, sans-serif; color: #555; padding: 16px; max-width: 32rem";
    const p = document.createElement("p");
    p.textContent =
      "The app did not open in this browser. You can still use it: save it as a file, or copy the code into a text file named app.html.";
    const save = document.createElement("button");
    save.type = "button";
    save.textContent = "Save the app";
    save.onclick = () => {
      const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = "app.html";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    };
    const copy = document.createElement("button");
    copy.type = "button";
    copy.textContent = "Copy the code";
    copy.style.marginLeft = "8px";
    copy.onclick = () => {
      navigator.clipboard.writeText(html).then(
        () => (copy.textContent = "Copied"),
        () => (copy.textContent = "Could not copy"),
      );
    };
    const again = document.createElement("button");
    again.type = "button";
    again.textContent = "Try again";
    again.style.marginLeft = "8px";
    again.onclick = () => location.reload();
    wrap.append(p, save, copy, again);
    document.body.append(wrap);
  };

  const giveUpMessage = () => {
    frame.remove();
    const p = document.createElement("p");
    p.textContent =
      "This tab can't show the app on its own. Go back to the Foundry page and press Open full screen again.";
    document.body.append(p);
  };
  // If the page that opened this tab was closed or has moved on, nobody answers; say so instead of waiting forever.
  const giveUp = setTimeout(giveUpMessage, 5000);

  window.addEventListener("message", (e) => {
    const d = e.data;
    if (!d) return;
    if (window.opener && e.source === window.opener && e.origin === location.origin) {
      if (d.type === "full-start" && typeof d.html === "string" && html === null) {
        html = d.html;
        clearTimeout(giveUp);
        stuckTimer = setTimeout(stuckMessage, 6000);
        if (typeof d.title === "string") document.title = d.title.slice(0, 80);
        send();
      }
    } else if (e.source === frame.contentWindow && d.type === "preview-loaded") {
      frameReady = true;
      // A slow phone may load the frame late: give the app its full few seconds from here too.
      if (html !== null && !shown && !stuck) {
        clearTimeout(stuckTimer);
        stuckTimer = setTimeout(stuckMessage, 6000);
      }
      send();
    } else if (e.source === frame.contentWindow && d.type === "preview-ready") {
      shown = true;
      clearTimeout(stuckTimer);
    } else if (e.source === frame.contentWindow && d.type === "preview-error" && d.fatal === true) {
      // Only a failure to start the app counts. A small error inside a running app is the app's own business.
      clearTimeout(stuckTimer);
      stuckMessage();
    }
  });

  if (window.opener) {
    frame.src = "/preview/frame.html";
    window.opener.postMessage({ type: "full-loaded" }, location.origin);
  } else {
    clearTimeout(giveUp);
    giveUpMessage();
  }
})();
