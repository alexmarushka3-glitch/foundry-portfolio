"use client";

import { useEffect, useRef, useState } from "react";
import { makeZip } from "@/lib/zip";

// The finished app from a real run: try it here, or download its code. The agents' files are laid over the
// sample app's repository. The app runs in a sandboxed frame in the visitor's browser (public/preview/).

const SQL_JS = "/vendor/sql.js-1.13.0";

/** The sample app's repository with the run's changed files on top. */
export async function finishedAppFiles(changes: Record<string, string>): Promise<Record<string, string>> {
  const { default: snapshot } = await import("@/lib/tasklySnapshot.json");
  return { ...(snapshot.files as Record<string, string>), ...changes };
}

/** SQLite compiled to WebAssembly. The frame may not fetch anything, so the page loads it and hands it over. */
let wasmLoad: Promise<ArrayBuffer> | null = null;
function loadWasm() {
  wasmLoad ??= fetch(`${SQL_JS}/sql-wasm.wasm`).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error("load failed"))));
  wasmLoad.catch(() => (wasmLoad = null));
  return wasmLoad;
}

export default function AppPreview({ files }: { files: Record<string, string> }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "starting" | "ready" | "failed">("idle");
  const [problem, setProblem] = useState("");
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!open) return;
    const onMessage = async (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow || !e.data) return;
      if (e.data.type === "preview-loaded") {
        try {
          const [all, wasm] = await Promise.all([finishedAppFiles(files), loadWasm()]);
          frame.current?.contentWindow?.postMessage({ type: "preview-start", files: all, wasm: wasm.slice(0) }, "*");
        } catch {
          setStatus("failed");
          setProblem("The preview couldn't load. Check your connection and try again.");
        }
      } else if (e.data.type === "preview-ready") {
        setStatus("ready");
      } else if (e.data.type === "preview-error") {
        setStatus("failed");
        setProblem(String(e.data.message).slice(0, 300));
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [open, files]);

  const download = async () => {
    const zip = makeZip(await finishedAppFiles(files), "taskly");
    const url = URL.createObjectURL(new Blob([zip as BlobPart], { type: "application/zip" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "taskly-with-the-new-feature.zip";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  return (
    <section className="app-preview" aria-label="The finished app">
      <h3>The finished app</h3>
      <p>The to-do app with the agents&apos; change in it. Try it here, or download the code.</p>
      <div className="app-preview-actions">
        <button
          type="button"
          className="btn btn-primary"
          aria-expanded={open}
          onClick={() => {
            setOpen((o) => !o);
            setStatus(open ? "idle" : "starting");
            setProblem("");
          }}
        >
          {open ? "Close the app" : "Try the app"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={download}>
          Download the code (.zip)
        </button>
      </div>
      {open && (
        <>
          <iframe
            ref={frame}
            className="app-frame"
            title="The finished to-do app, running in your browser"
            sandbox="allow-scripts allow-forms allow-modals"
            src="/preview/frame.html"
          />
          <p className="fine" aria-live="polite">
            {status === "starting" && "Starting the app… "}
            {status === "failed" && <span className="error-inline">{problem} You can still download the code. </span>}
            It runs in your browser with a fresh, empty list, and nothing you add is saved. The server code is the app&apos;s real
            code, running on small stand-ins for Express and SQLite, so it can differ slightly from running it with Node.
          </p>
        </>
      )}
      <p className="fine">To run the download: install Node 22.13 or newer, then run npm install and npm start in the folder.</p>
    </section>
  );
}
