// Small pieces of the run API, kept out of the route file so they can be tested on their own.

import { MAX_INPUT } from "../limits";

type Parsed = { ok: true; request: string } | { ok: false; error: string };

/** Clean up and validate the visitor's idea. Control characters are stripped so odd input can't mangle the prompt or the stream. */
export function parseRequest(body: unknown): Parsed {
  const raw = (body as { request?: unknown } | null)?.request;
  const request = typeof raw === "string" ? raw.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim() : "";
  if (!request) return { ok: false, error: "Type an idea first." };
  if (request.length > MAX_INPUT) return { ok: false, error: `Keep it under ${MAX_INPUT} characters.` };
  return { ok: true, request };
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
