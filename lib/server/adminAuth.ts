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

const sign = (token: string, exp: string) => createHmac("sha256", token).update(`foundry-admin-session:${exp}`).digest("hex");

/**
 * The cookie value for a signed-in admin: an expiry time and a signature over it, "<expiry ms>.<hex>". The server
 * checks the expiry itself, so a copied cookie stops working when it runs out, and not only when the browser drops it.
 * It also changes whenever the token does, which signs everyone out.
 */
export function sessionValue(now = Date.now()): string | null {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return null;
  const exp = String(now + ADMIN_SESSION_SECONDS * 1000);
  return `${exp}.${sign(token, exp)}`;
}

export function sessionValid(cookieValue: string | undefined, now = Date.now()): boolean {
  const token = process.env.ADMIN_TOKEN;
  if (!token || !cookieValue) return false;
  const [exp, mac, extra] = cookieValue.split(".");
  if (extra !== undefined || !exp || !mac || !/^\d{1,15}$/.test(exp)) return false;
  const expMs = Number(exp);
  // expired, or an expiry further away than a session can be (a forged or tampered value)
  if (expMs <= now || expMs > now + ADMIN_SESSION_SECONDS * 1000 + 60_000) return false;
  const expected = sign(token, exp);
  if (mac.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(mac), Buffer.from(expected));
}

/**
 * Refuses a state-changing request that a browser says came from another site. The cookie is SameSite=Strict, which
 * already stops that; this is a second lock. Requests with no Origin header (scripts, tests) are left alone.
 */
export function blockCrossSite(req: Request): Response | null {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return null;
  const origin = req.headers.get("origin");
  if (!origin) return null;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return Response.json({ error: "Cross-site request blocked." }, { status: 403 });
  }
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? new URL(req.url).host;
  return originHost === host ? null : Response.json({ error: "Cross-site request blocked." }, { status: 403 });
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
  const crossSite = blockCrossSite(req);
  if (crossSite) return crossSite;
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
