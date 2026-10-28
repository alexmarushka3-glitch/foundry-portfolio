import type { LiveRecording, TimedEvent } from "@/lib/recorder/capture";
import type { AgentName, FoundryEvent } from "@/lib/types";

export const FIXTURE_REQUEST = "Let users set a due date on tasks";

const ev = (at: number, event: FoundryEvent): TimedEvent => ({ at, event });

/** A small, finished, one-round live recording with a tool event. */
export function fixtureRecording(): LiveRecording {
  const events: TimedEvent[] = [ev(0, { type: "mode", mode: "live" })];
  let t = 100;
  const order: AgentName[] = ["researcher", "story", "pm", "backend", "frontend", "e2e", "validator", "release"];
  for (const agent of order) {
    events.push(ev(t, { type: "start", agent, round: 1, model: "m" }));
    if (agent === "researcher") events.push(ev(t + 5, { type: "tool", agent, round: 1, label: "read src/db.js", ok: true }));
    events.push(ev(t + 10, { type: "token", agent, round: 1, text: `${agent} says hi` }));
    t += 3000;
    events.push(ev(t, { type: "done", agent, round: 1, ms: 3000 }));
    events.push(ev(t, { type: "usage", agent, round: 1, inputTokens: 1, outputTokens: 1, costUsd: 0.01 }));
    if (agent === "e2e") events.push(ev(t, { type: "verdict", gate: "e2e", round: 1, approved: true }));
    if (agent === "validator") events.push(ev(t, { type: "verdict", gate: "validator", round: 1, approved: true }));
    t += 5;
  }
  events.push(ev(t, { type: "finish", ms: t, rounds: 1, approved: true }));
  return { slug: "fixture", request: FIXTURE_REQUEST, recordedAt: "2026-10-27T00:00:00.000Z", events, approved: true, rounds: 1, totalMs: t, costUsd: 0.08 };
}
