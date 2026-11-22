// Offers to add a hosted app link (/a/<id>) to the device as an app, in the fewest taps the browser allows. It runs in
// the wrapper page, which is the site's own code; the app itself stays sealed in its frame and never sees this.
//   Chrome, Edge (Android and computers): one "Install app" button that opens the browser's own install question.
//   iPhone, iPad, Safari on a Mac: Apple gives websites no way to start this, so a short note says what to tap.
//   Already installed (opened as an app), or dismissed: nothing is shown.
// The note sits above the app's frame in the page layout (the wrapper is a flex column), so it never covers the app: the
// frame just gets a little shorter until the note is dismissed.
(function () {
  "use strict";
  var match = /^\/a\/([A-Za-z0-9_-]{22})\/?$/.exec(location.pathname);
  if (!match) return;
  var DISMISSED = "foundry:install-dismissed:" + match[1];
  var KEEP_QUIET_MS = 30 * 24 * 3600 * 1000; // up to this long: a browser may clear what a page stored sooner

  function installed() {
    try {
      if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) return true;
    } catch (e) {}
    return navigator.standalone === true; // iOS home-screen apps
  }

  function dismissedRecently() {
    try {
      var at = Number(window.localStorage.getItem(DISMISSED));
      return at > 0 && Date.now() - at < KEEP_QUIET_MS;
    } catch (e) {
      return false;
    }
  }

  var bar = null;

  function hide() {
    if (bar && bar.parentNode) bar.parentNode.removeChild(bar);
    bar = null;
  }

  function dismiss() {
    try {
      window.localStorage.setItem(DISMISSED, String(Date.now()));
    } catch (e) {}
    hide();
  }

  function button(label, primary, onClick) {
    var b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.style.cssText =
      "min-height:44px;padding:0 16px;border-radius:10px;font:600 14px system-ui,sans-serif;cursor:pointer;border:1px solid #fff;" +
      (primary ? "background:#fff;color:#1e252b" : "background:transparent;color:#fff");
    b.addEventListener("click", onClick);
    return b;
  }

  function show(text, buttons) {
    if (bar || installed() || dismissedRecently() || !document.body) return;
    bar = document.createElement("div");
    bar.setAttribute("role", "region");
    bar.setAttribute("aria-label", "Add this web app to your device");
    bar.style.cssText =
      "flex:none;display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:12px 14px;background:#1e252b;color:#fff;" +
      "font:14px/1.4 system-ui,sans-serif;border-bottom:1px solid #4a5560";
    var p = document.createElement("p");
    p.style.cssText = "margin:0;flex:1 1 220px";
    p.textContent = text;
    bar.appendChild(p);
    for (var i = 0; i < buttons.length; i++) bar.appendChild(buttons[i]);
    // Before the app's frame: it is reached first by keyboard and screen reader, and the frame takes the space left.
    var frame = document.querySelector("iframe");
    if (frame && frame.parentNode === document.body) document.body.insertBefore(bar, frame);
    else document.body.appendChild(bar);
  }

  var AFTER =
    " It opens on its own, next to your other apps. It is not an App Store app and needs a connection.";
  var ua = navigator.userAgent || "";
  var ios =
    /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1);
  // Other browsers on an iPhone, and the browsers inside apps (Messages links, Instagram, Facebook), have other menus.
  var notSafariOnIos =
    /CriOS|FxiOS|EdgiOS|OPiOS|FBAN|FBAV|Instagram|Line\/|MicroMessenger|GSA\//.test(ua) ||
    !/Safari\//.test(ua); // a web view inside another app (LinkedIn, X, Gmail...) has no Safari token
  var safariVersion = /Version\/(\d+)/.exec(ua);
  // Safari 17 also runs on macOS 13, which has no Add to Dock, and the user agent cannot tell the two apart: the note
  // names the macOS version instead.
  var macSafari =
    !ios &&
    /Macintosh/.test(ua) &&
    /Safari\//.test(ua) &&
    !/Chrome|Chromium|Edg|OPR|Firefox/.test(ua) &&
    !!safariVersion &&
    Number(safariVersion[1]) >= 17;

  // Chrome and Edge say when the page can be installed, and let the page ask the question at a tap of its own.
  var deferred = null;
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault(); // keep it for the button, instead of the browser's own small bar
    deferred = e;
    show("Install this web app." + AFTER, [
      button("Install app", true, function () {
        var ask = deferred;
        deferred = null;
        hide();
        if (!ask) return;
        try {
          var asked = ask.prompt();
          if (asked && asked.catch) asked.catch(function () {});
          // Saying no to the browser's question counts as Not now, so the note does not come straight back.
          if (ask.userChoice && ask.userChoice.then) {
            ask.userChoice.then(function (choice) {
              if (!choice || choice.outcome !== "accepted") dismiss();
            }, function () {});
          }
        } catch (err) {}
      }),
      button("Not now", false, dismiss),
    ]);
  });
  window.addEventListener("appinstalled", hide);

  if (ios) {
    var steps = "tap Share (or ⋯, then Share), then Add to Home Screen.";
    show(
      (notSafariOnIos
        ? "Add this web app to your Home Screen: open this link in Safari, " + steps
        : "Add this web app to your Home Screen: " + steps) + AFTER,
      [button("Got it", true, dismiss)],
    );
  } else if (macSafari) {
    show(
      "Add this web app to your Dock: in Safari on macOS 14 or newer, choose File, then Add to Dock." +
        AFTER,
      [button("Got it", true, dismiss)],
    );
  }
})();
