"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { appFileName, appTitle, bundleApp } from "@/lib/bundle";
import { SHARE_TTL_DAYS } from "@/lib/share";

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

export default function AppPreview({
  files,
  howTo = [],
}: {
  files: Record<string, string>;
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
  const frame = useRef<HTMLIFrameElement>(null);
  const fullTab = useRef<Window | null>(null);

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
  const latestHtml = useRef(html);
  latestHtml.current = html;
  useEffect(() => {
    setLink("");
    setNote("");
  }, [html]);
  const linkInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (link) linkInput.current?.focus(); // so a screen reader announces the new link
  }, [link]);

  const getLink = async () => {
    setNote("");
    setSharing(true);
    const sentFor = html;
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (latestHtml.current !== sentFor) return; // another app was built while this one was waiting
      if (res.ok && data.url) setLink(data.url);
      else setNote(data.error ?? "Could not make a link right now. Try Save the app.");
    } catch {
      setNote("Could not make a link right now. Try Save the app.");
    } finally {
      setSharing(false);
    }
  };

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
      else if (e.data.type === "preview-ready") setStatus((s) => (s === "failed" ? s : "ready"));
      else if (e.data.type === "preview-error") {
        setStatus("failed");
        setProblem(String(e.data.message).slice(0, 200));
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
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
      setNote("Your browser would not let the page copy. Try Save the app instead.");
    }
  };

  return (
    <section className="app-preview" aria-label="Your app">
      <div className="app-preview-head">
        <h3>Your app: {title}</h3>
        <div className="app-actions">
          <button type="button" className="btn btn-primary" onClick={save}>
            Save the app
          </button>
          <button type="button" className="btn btn-ghost" onClick={openFull}>
            Open full screen
          </button>
          {canShare && (
            <button type="button" className="btn btn-ghost" onClick={getLink} disabled={sharing}>
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
          <button type="button" className="btn btn-ghost" onClick={copyLink}>
            Copy link
          </button>
          <p className="fine" id="app-link-fine">
            Anyone with this link can open the app in a browser for {SHARE_TTL_DAYS} days, then it
            is deleted. On the link the app keeps nothing; save the app to keep your data.
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
          <li>Like it? Press Save the app to keep it on your device.</li>
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
          <span className="error-inline">The app hit an error: {problem} </span>
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
