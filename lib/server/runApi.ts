// Small pieces of the run API, kept out of the route file so they can be tested on their own.

import { MAX_INPUT } from "../limits";
import { findRecording } from "../run";
import { buildRequest, validateSpec } from "../spec";

type Parsed = { ok: true; request: string } | { ok: false; error: string };

/**
 * Turn the browser's body into the request the agents get. A `spec` (fixed choices) is validated and rebuilt into
 * a sentence here, so raw visitor text never reaches a prompt. A plain `request` is only accepted if it is one of
 * the recorded examples, which replay for free.
 */
export function parseRequest(body: unknown): Parsed {
  const b = (body ?? {}) as { request?: unknown; spec?: unknown };
  if (b.spec !== undefined) {
    const checked = validateSpec(b.spec);
    return checked.ok ? { ok: true, request: buildRequest(checked.spec) } : checked;
  }
  const raw = typeof b.request === "string" ? b.request.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim() : "";
  if (!raw) return { ok: false, error: "Pick what you want built first." };
  if (raw.length > MAX_INPUT) return { ok: false, error: `Keep it under ${MAX_INPUT} characters.` };
  if (!findRecording(raw)) return { ok: false, error: "Pick a feature type and a name, or choose one of the examples." };
  return { ok: true, request: raw };
}

/** Who is asking, for the per-visitor limit. Behind Vercel the first forwarded address is the visitor's. */
export function visitorAddress(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip")?.trim() || "unknown";
}

type ApiError = { name?: string; status?: number; message?: string; error?: { error?: { type?: string } } };

/** Log why a run failed for the site owner: error type, status, and a trimmed message with anything key-shaped removed. */
export function logRunFailure(err: unknown): void {
  const e = err as ApiError;
  console.error(
    "run failed:",
    e?.name ?? typeof err,
    e?.status ?? "",
    e?.error?.error?.type ?? "",
    String(e?.message ?? "").replace(/sk-[A-Za-z0-9_-]{8,}/g, "[key]").slice(0, 200),
  );
  // Describe the key's shape (never its value) so a bad paste is easy to spot.
  const k = process.env.ANTHROPIC_API_KEY ?? "";
  console.error("key shape:", {
    set: k.length > 0,
    length: k.length,
    startsWithSkAnt: k.startsWith("sk-ant-"),
    hasWhitespace: /\s/.test(k),
    hasQuotes: /["']/.test(k),
    hasEqualsSign: k.includes("="),
    hasAuthTokenVar: Boolean(process.env.ANTHROPIC_AUTH_TOKEN),
    hasBaseUrlVar: Boolean(process.env.ANTHROPIC_BASE_URL),
    hasProfileVar: Boolean(process.env.ANTHROPIC_PROFILE),
  });
}

const GENERIC_FAILURE = "The run stopped before it finished. Try again in a moment.";

/** What the visitor sees. Our own short messages pass through; raw API errors, which can include request details, never do. */
export function visitorMessage(err: unknown): string {
  if (err instanceof Error && err.message.length < 140 && !/api|key|auth|token/i.test(err.message)) return err.message;
  return GENERIC_FAILURE;
}
