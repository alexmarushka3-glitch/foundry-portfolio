import { createHash, createHmac, timingSafeEqual } from "node:crypto";

// The admin dashboard is protected by one shared secret, ADMIN_TOKEN. With no token set, the dashboard
// and its API don't exist (404). Signing in sets an HTTP-only cookie holding a value derived from the token.

export const ADMIN_COOKIE = "foundry_admin";
export const ADMIN_SESSION_SECONDS = 8 * 3600;

export const adminEnabled = (): boolean => Boolean(process.env.ADMIN_TOKEN);

const digest = (s: string) => createHash("sha256").update(s).digest();

/** True when `input` is the admin token. Compares fixed-length digests in constant time. */
export function tokenMatches(input: string): boolean {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return false;
  return timingSafeEqual(digest(input), digest(token));
}

/** The cookie value for a signed-in admin. It changes whenever the token does, which signs everyone out. */
export function sessionValue(): string | null {
  const token = process.env.ADMIN_TOKEN;
  return token ? createHmac("sha256", token).update("foundry-admin-session").digest("hex") : null;
}

export function sessionValid(cookieValue: string | undefined): boolean {
  const expected = sessionValue();
  if (!expected || !cookieValue || cookieValue.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(cookieValue), Buffer.from(expected));
}

export function cookieFromHeader(header: string | null, name = ADMIN_COOKIE): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return undefined;
}

/** For route handlers. Returns a response when the caller may not continue, or null when they may. */
export function requireAdmin(req: Request): Response | null {
  if (!adminEnabled()) return new Response("Not found", { status: 404 });
  if (!sessionValid(cookieFromHeader(req.headers.get("cookie")))) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }
  return null;
}

export const sessionCookie = (value: string, maxAge = ADMIN_SESSION_SECONDS): string =>
  [
    `${ADMIN_COOKIE}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${maxAge}`,
    process.env.NODE_ENV === "production" ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
