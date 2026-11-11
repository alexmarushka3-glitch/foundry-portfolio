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

  const send = () => {
    if (html === null || !frameReady || sent) return;
    sent = true;
    frame.contentWindow.postMessage({ type: "preview-start", html }, "*");
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
        if (typeof d.title === "string") document.title = d.title.slice(0, 80);
        send();
      }
    } else if (e.source === frame.contentWindow && d.type === "preview-loaded") {
      frameReady = true;
      send();
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
