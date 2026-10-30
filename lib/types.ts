// Types shared by the server pipeline and the browser stage. No runtime code here.

export type AgentName =
  | "researcher"
  | "story"
  | "pm"
  | "backend"
  | "frontend"
  | "e2e"
  | "validator"
  | "release";

export type Gate = "e2e" | "validator";

export type Mode = "live" | "simulated" | "replay";

export type FoundryEvent =
  | { type: "mode"; mode: Mode; reason?: string }
  | { type: "start"; agent: AgentName; round: number; model: string }
  | { type: "token"; agent: AgentName; round: number; text: string }
  | { type: "tool"; agent: AgentName; round: number; label: string; ok: boolean }
  | { type: "shot"; agent: AgentName; round: number; label: string; /** A PNG picture of the real browser page, base64. */ png: string }
  | { type: "done"; agent: AgentName; round: number; ms: number }
  | { type: "usage"; agent: AgentName; round: number; inputTokens: number; outputTokens: number; costUsd: number }
  | { type: "verdict"; gate: Gate; round: number; approved: boolean }
  | { type: "pr"; url: string; number: number }
  /** The files the engineers wrote, path -> content. Sent only by a live run that passed both checks. */
  | { type: "files"; files: Record<string, string> }
  | { type: "finish"; ms: number; rounds: number; approved: boolean; costUsd?: number }
  | { type: "error"; message: string };

export type Emit = (e: FoundryEvent) => void;
