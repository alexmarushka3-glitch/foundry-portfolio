"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { appFileName, appTitle, bundleApp } from "@/lib/bundle";

// The finished app from a real run, as one self-contained .html file. It opens right here in a sandboxed, offline frame
// (public/preview/), and visitors can save the same file to keep and open later.

export default function AppPreview({ files, howTo = [] }: { files: Record<string, string>; howTo?: string[] }) {
  const html = useMemo(() => bundleApp(files), [files]);
  const title = useMemo(() => appTitle(html), [html]);
  const [status, setStatus] = useState<"starting" | "ready" | "failed">("starting");
  const [problem, setProblem] = useState("");
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    setStatus("starting");
    setProblem("");
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow || !e.data) return;
      if (e.data.type === "preview-loaded") frame.current?.contentWindow?.postMessage({ type: "preview-start", html }, "*");
      else if (e.data.type === "preview-ready") setStatus((s) => (s === "failed" ? s : "ready"));
      else if (e.data.type === "preview-error") {
        setStatus("failed");
        setProblem(String(e.data.message).slice(0, 200));
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [html]);

  const save = () => {
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = appFileName(html);
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  return (
    <section className="app-preview" aria-label="Your app">
      <div className="app-preview-head">
        <h3>Your app: {title}</h3>
        <button type="button" className="btn btn-primary" onClick={save}>
          Save the app
        </button>
      </div>
      <div className="app-next">
        <h4>What to do now</h4>
        <ol>
          {(howTo.length ? howTo : ["Fill in the boxes and press the buttons, like you would in any app."]).map((h) => (
            <li key={h}>{h}</li>
          ))}
          <li>Like it? Press Save the app to keep it on your device.</li>
        </ol>
        {howTo.length > 0 && <p className="fine">These steps were written by the Release agent for this app.</p>}
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
        {status === "failed" && <span className="error-inline">The app hit an error: {problem} </span>}
        Use it here (nothing is kept), or save it: one file that opens in any browser, works offline and remembers your data
        on your device.
      </p>
    </section>
  );
}
