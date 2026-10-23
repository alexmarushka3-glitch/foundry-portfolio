"use client";

import { useRef, useState } from "react";
import type { AgentName, FoundryEvent, Gate } from "@/lib/pipeline";

type Card = {
  key: string;
  agent: AgentName;
  round: number;
  model: string;
  text: string;
  status: "running" | "done";
  ms?: number;
  passed?: boolean;
};

const ORDER: AgentName[] = ["researcher", "story", "pm", "backend", "frontend", "e2e", "validator", "release"];
const LABEL: Record<AgentName, string> = {
  researcher: "Researcher",
  story: "Story Writer",
  pm: "Project Manager",
  backend: "Backend",
  frontend: "Frontend",
  e2e: "E2E Verifier",
  validator: "Validator",
  release: "Release",
};
const NOTE: Partial<Record<AgentName, string>> = {
  researcher: "read-only",
};
const BADGE: Record<Gate, [string, string]> = {
  e2e: ["Flows passed", "Flow failed"],
  validator: ["Approved", "Changes requested"],
};
const EXAMPLES = [
  "Let users set a due date on tasks",
  "Add a priority label to each task",
  "Add a search box to filter tasks",
];

export default function Demo() {
  const [request, setRequest] = useState(EXAMPLES[0]);
  const [cards, setCards] = useState<Card[]>([]);
  const [mode, setMode] = useState<"live" | "simulated" | "replay" | null>(null);
  const [running, setRunning] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  function apply(e: FoundryEvent) {
    switch (e.type) {
      case "mode":
        setMode(e.mode);
        break;
      case "start":
        setCards((c) => [
          ...c,
          { key: `${e.agent}-${e.round}`, agent: e.agent, round: e.round, model: e.model, text: "", status: "running" },
        ]);
        break;
      case "token":
        setCards((c) => c.map((x) => (x.key === `${e.agent}-${e.round}` ? { ...x, text: x.text + e.text } : x)));
        break;
      case "done":
        setCards((c) => c.map((x) => (x.key === `${e.agent}-${e.round}` ? { ...x, status: "done", ms: e.ms } : x)));
        break;
      case "verdict":
        setCards((c) => c.map((x) => (x.key === `${e.gate}-${e.round}` ? { ...x, passed: e.approved } : x)));
        break;
      case "finish":
        setSummary(
          `${e.approved ? "Approved" : "Finished without approval"} in ${(e.ms / 1000).toFixed(1)}s of real run time across ${e.rounds} build round${e.rounds > 1 ? "s" : ""}.`,
        );
        break;
      case "error":
        setError(e.message);
        break;
    }
  }

  async function run() {
    if (running || !request.trim()) return;
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setCards([]);
    setSummary(null);
    setError(null);
    setRunning(true);
    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (line) apply(JSON.parse(line) as FoundryEvent);
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") setError((err as Error).message);
    } finally {
      setRunning(false);
    }
  }

  const activeAgents = new Set(cards.filter((c) => c.status === "running").map((c) => c.agent));

  // Backend and Frontend run in parallel, so show each round's pair side by side.
  const rows: Card[][] = [];
  for (const c of cards) {
    const last = rows[rows.length - 1];
    const isBuild = c.agent === "backend" || c.agent === "frontend";
    if (isBuild && last && last[0].round === c.round && (last[0].agent === "backend" || last[0].agent === "frontend")) {
      last.push(c);
    } else {
      rows.push([c]);
    }
  }

  return (
    <div className="demo">
      <form
        className="demo-form"
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
      >
        <label htmlFor="req">Rough idea for the taskly sample app</label>
        <div className="row">
          <input
            id="req"
            value={request}
            maxLength={200}
            onChange={(e) => setRequest(e.target.value)}
            placeholder="Pick an example below, or type your own (simulated)"
          />
          <button className="btn primary" disabled={running || !request.trim()} type="submit">
            {running ? "Running..." : "Build it"}
          </button>
        </div>
        <div className="chips">
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" className="chip" disabled={running} onClick={() => setRequest(ex)}>
              {ex}
            </button>
          ))}
        </div>
      </form>

      <ol className="pipeline" aria-label="Pipeline stages">
        {ORDER.map((a) => (
          <li
            key={a}
            className={
              activeAgents.has(a)
                ? "on"
                : cards.some((c) => c.agent === a && c.status === "done")
                  ? "ok"
                  : ""
            }
          >
            {LABEL[a]}
          </li>
        ))}
      </ol>

      {mode && (
        <p className="modeline">
          Mode:{" "}
          <strong>
            {mode === "live"
              ? "live Claude models"
              : mode === "replay"
                ? "replay of a real run (output is genuine Claude output, played back faster than it ran)"
                : "simulated (scripted text, not model output)"}
          </strong>
          {" · "}E2E flows are walked by the agent, not a real browser.
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <div className="cards" aria-live="polite">
        {rows.map((row) => (
          <div key={row.map((c) => c.key).join("+")} className={row.length > 1 ? "pair" : "single"}>
            {row.map((c) => (
              <article key={c.key} className={`acard ${c.status}`}>
                <header>
                  <span className="aname">
                    {LABEL[c.agent]}
                    {c.round > 1 && c.agent !== "release" ? ` (round ${c.round})` : ""}
                  </span>
                  {NOTE[c.agent] && <span className="tag">{NOTE[c.agent]}</span>}
                  <span className="amodel">{c.model}</span>
                  {c.status === "done" && <span className="ams">{(c.ms! / 1000).toFixed(1)}s</span>}
                  {c.passed !== undefined && (c.agent === "e2e" || c.agent === "validator") && (
                    <span className={`badge ${c.passed ? "good" : "warn"}`}>{BADGE[c.agent][c.passed ? 0 : 1]}</span>
                  )}
                </header>
                <pre>
                  {c.text}
                  {c.status === "running" && <span className="cursor" />}
                </pre>
              </article>
            ))}
          </div>
        ))}
      </div>
      {summary && <p className="summary">{summary}</p>}
    </div>
  );
}
