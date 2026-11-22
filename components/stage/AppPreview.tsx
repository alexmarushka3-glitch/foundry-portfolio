"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { appFileName, appTitle, bundleApp } from "@/lib/bundle";
import { SHARE_IDLE_DAYS, SHARE_MAX_DAYS } from "@/lib/share";

// The finished app from a real run, as one self-contained .html file. It opens right here in a sandboxed, offline frame
// (public/preview/), and visitors can save the same file to keep and open later.

// The "Save as" window (Chrome and Edge only), so it is not in TypeScript's built-in types for every setup.
type SaveWindow = Window & {
  showSaveFilePicker?: (options: {
    suggestedName: string;
    types: { description: string; accept: Record<string, string[]> }[];
  }) => Promise<{
    createWritable: () => Promise<{
      write: (d: string) => Promise<void>;
      close: () => Promise<void>;
    }>;
  }>;
};

type Device = "ios" | "android" | "desktop";

/** How to put a link on a home screen (or install it), for the device the visitor is on. */
const ADD_STEPS: Record<Device, string> = {
  ios: "Open the link in Safari, tap Share (or ⋯, then Share), then Add to Home Screen.",
  android: "Open the link in Chrome and tap Install app (or ⋮, then Install app).",
  desktop:
    "Open the link in Chrome or Edge and click Install app, or the install icon at the right end of the address bar. In Safari on macOS 14 or newer: File, then Add to Dock.",
};

/** How long the preview frame gets to show the app before the page says it did not start. */
const PREVIEW_START_MS = 8000;

export default function AppPreview({
  files,
  sig,
  howTo = [],
}: {
  files: Record<string, string>;
  /** The server's signature for these files (a live run); a replay has none and is matched by the server instead. */
  sig?: string;
  howTo?: string[];
}) {
  const html = useMemo(() => bundleApp(files), [files]);
  const title = useMemo(() => appTitle(html), [html]);
  const [status, setStatus] = useState<"starting" | "ready" | "failed">("starting");
  const [problem, setProblem] = useState("");
  const [note, setNote] = useState("");
  // Hosted links: offered only when the server says it can keep them (it needs the database).
  const [canShare, setCanShare] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [link, setLink] = useState("");
  const [device, setDevice] = useState<Device>("desktop");
  const frame = useRef<HTMLIFrameElement>(null);
  const fullTab = useRef<Window | null>(null);

  useEffect(() => {
    const ua = navigator.userAgent;
    // An iPad asks for the desktop site and says it is a Mac, but it has a touch screen.
    if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1))
      setDevice("ios");
    else if (/Android/.test(ua)) setDevice("android");
  }, []);

  useEffect(() => {
    let alive = true;
    fetch("/api/share")
      .then((r) => r.json())
      .then((d: { available?: unknown }) => alive && setCanShare(d.available === true))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  // A new app means any link, message or request for the old one is stale.
  const linkRequest = useRef(0);
  // Only when the app really changes: on the first run a click could already have set a message, and that would erase it.
  const shownHtml = useRef(html);
  useEffect(() => {
    if (shownHtml.current === html) return;
    shownHtml.current = html;
    linkRequest.current++; // an answer still on its way belongs to the old app
    setSharing(false);
    setLink("");
    setNote("");
  }, [html]);
  const linkInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (link) linkInput.current?.focus(); // so a screen reader announces the new link
  }, [link]);

  const getLink = async () => {
    setNote("Making a link…"); // read out by the status line below
    setSharing(true);
    const mine = ++linkRequest.current;
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files, sig }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (mine !== linkRequest.current) return; // another app was built while this one was waiting
      if (res.ok && data.url) setLink(data.url);
      else setNote(data.error ?? "Could not make a link right now. Try Save the web app.");
    } catch {
      if (mine === linkRequest.current)
        setNote("Could not make a link right now. Try Save the web app.");
    } finally {
      if (mine === linkRequest.current) setSharing(false); // a newer request owns the button now
    }
  };

  // A real run gets its link as soon as the app is ready, so it can be put on a home screen without another click.
  // (A recorded example keeps the button: replays are free and unlimited, and each link uses up the site's daily limit.)
  const autoFor = useRef("");
  useEffect(() => {
    if (!canShare || !sig || autoFor.current === html) return;
    autoFor.current = html;
    void getLink();
    // getLink only reads this render's files and sig, which are what html and sig change with
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canShare, sig, html]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setNote("Link copied.");
    } catch {
      setNote("Your browser would not let the page copy. Select the link and copy it yourself.");
    }
  };

  useEffect(() => {
    setStatus("starting");
    setProblem("");
    let reported = false; // the app itself said it failed: a late "ready" must not hide that
    // The preview frame has a few seconds to show the app. If it never does (a browser that blocks the frame's
    // script), say so with ways out instead of leaving "Opening the app…" on screen forever.
    const stuckTimer = window.setTimeout(() => {
      // Cleared as soon as the app says ready or failed, so reaching here means it said nothing.
      setProblem(
        "the preview did not start in this browser. Try Open full screen, Save the web app or Copy the code.",
      );
      setStatus("failed");
    }, PREVIEW_START_MS);
    const onMessage = (e: MessageEvent) => {
      if (!e.data) return;
      // The full-screen tab (public/preview/full.js) asks for the app each time it loads, so a refresh works too.
      if (
        e.source &&
        e.source === fullTab.current &&
        e.origin === window.location.origin &&
        e.data.type === "full-loaded"
      ) {
        fullTab.current?.postMessage({ type: "full-start", html, title }, window.location.origin);
        return;
      }
      if (e.source !== frame.current?.contentWindow) return;
      if (e.data.type === "preview-loaded")
        frame.current?.contentWindow?.postMessage({ type: "preview-start", html }, "*");
      else if (e.data.type === "preview-ready") {
        if (reported) return;
        window.clearTimeout(stuckTimer);
        setProblem("");
        setStatus("ready"); // also takes back the "did not start" notice when the app only opened slowly
      } else if (e.data.type === "preview-error" && e.data.fatal === true) {
        // Only a failure to start the app (marked fatal by the frame). The frame also forwards every uncaught error the
        // app throws later, such as in a click handler; the app is still running then, as it is in the full-screen tab.
        reported = true;
        window.clearTimeout(stuckTimer);
        setStatus("failed");
        setProblem(String(e.data.message ?? "unknown error").slice(0, 200));
      }
    };
    window.addEventListener("message", onMessage);
    return () => {
      window.clearTimeout(stuckTimer);
      window.removeEventListener("message", onMessage);
    };
  }, [html, title]);

  const download = () => {
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = appFileName(html);
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  // Chrome and Edge can open the normal "Save as" window with the name filled in; it saves the file without a
  // browser download, which some company computers block. Other browsers (and any failure) fall back to a download.
  const save = async () => {
    setNote("");
    const picker = (window as SaveWindow).showSaveFilePicker;
    if (picker) {
      let handle: Awaited<ReturnType<NonNullable<SaveWindow["showSaveFilePicker"]>>> | null = null;
      try {
        handle = await picker.call(window, {
          suggestedName: appFileName(html),
          types: [{ description: "Web page", accept: { "text/html": [".html"] } }],
        });
      } catch (err) {
        if ((err as Error).name === "AbortError") return; // the visitor closed the window
        // any other refusal (not allowed here, blocked by policy): try a normal download below
      }
      if (handle) {
        // The file now exists, so a failed write must not fall through to a second copy by download.
        try {
          const out = await handle.createWritable();
          await out.write(html);
          await out.close();
          setNote("Saved.");
        } catch {
          setNote("The file could not be written. Try Open full screen or Copy the code instead.");
        }
        return;
      }
    }
    download();
    setNote(
      "Download started. If your computer blocks downloads, use Open full screen or Copy the code.",
    );
  };

  const openFull = () => {
    setNote("");
    fullTab.current = window.open("/preview/full.html", "_blank");
    if (!fullTab.current)
      setNote("Your browser blocked the new tab. Allow pop-ups for this site and try again.");
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(html);
      setNote("Copied. Paste it into a text file and name the file app.html.");
    } catch {
      setNote("Your browser would not let the page copy. Try Save the web app instead.");
    }
  };

  return (
    <section className="app-preview" aria-label="Your web app">
      <div className="app-preview-head">
        <h3>Your web app: {title}</h3>
        <div className="app-actions">
          <button type="button" className="btn btn-primary" onClick={save}>
            Save the web app
          </button>
          <button type="button" className="btn btn-ghost" onClick={openFull}>
            Open full screen
          </button>
          {canShare && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={getLink}
              disabled={sharing || link !== ""}
            >
              {sharing ? "Making a link…" : "Get a link"}
            </button>
          )}
        </div>
      </div>
      {link && (
        <div className="app-link">
          <label>
            Your link
            <input
              ref={linkInput}
              readOnly
              value={link}
              onFocus={(e) => e.currentTarget.select()}
              aria-describedby="app-link-fine"
            />
          </label>
          <div className="app-link-buttons">
            <button type="button" className="btn btn-ghost" onClick={copyLink}>
              Copy link
            </button>
            <a className="btn btn-ghost" href={link} target="_blank" rel="noopener">
              Open it
            </a>
          </div>
          <p className="fine" id="app-link-fine">
            Anyone with this link can open it in a browser. The link works for {SHARE_IDLE_DAYS}{" "}
            days after it is last opened, and {SHARE_MAX_DAYS} days at most, then it is deleted from
            our server. It keeps its data on your device, usually until you clear your browser data.
            Added to the home screen, it does not share data with the same link opened in the
            browser.
          </p>
          <p className="fine">
            <strong>Add it to your device.</strong> {ADD_STEPS[device]} That puts a web app next to
            your other apps. It is not an App Store app, and it needs an internet connection.
          </p>
        </div>
      )}
      <div className="app-next">
        <h4>What to do now</h4>
        <ol>
          {(howTo.length
            ? howTo
            : ["Fill in the boxes and press the buttons, like you would in any app."]
          ).map((h) => (
            <li key={h}>{h}</li>
          ))}
          <li>Like it? Press Save the web app to keep it on your device.</li>
        </ol>
        {howTo.length > 0 && (
          <p className="fine">These steps were written by the Release agent for this app.</p>
        )}
      </div>
      <iframe
        key={html}
        ref={frame}
        className="app-frame"
        title={`${title}, running in your browser`}
        sandbox="allow-scripts allow-forms allow-modals"
        // Lets a "Copy" button in the app work; the frame can still only write to the clipboard on a click.
        allow="clipboard-write"
        src="/preview/frame.html"
      />
      <p className="fine" aria-live="polite">
        {status === "failed" && (
          <span className="error-inline">The web app hit an error: {problem} </span>
        )}
        Use it here or full screen (nothing is kept), or save it: one file that opens in any
        browser, works offline and remembers your data on your device.
      </p>
      <p className="fine">
        Can't save on this computer?{" "}
        <button type="button" className="link-button" onClick={copyCode}>
          Copy the code
        </button>{" "}
        instead and paste it into a text file named app.html.
      </p>
      <p className="fine" role="status" aria-live="polite">
        {note}
      </p>
    </section>
  );
}
