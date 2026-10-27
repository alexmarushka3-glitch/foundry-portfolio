import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { POST as actions } from "@/app/api/admin/actions/route";
import { POST as login } from "@/app/api/admin/login/route";
import { ADMIN_SESSION_SECONDS, blockCrossSite, sessionValid, sessionValue } from "@/lib/server/adminAuth";
import { MAX_BODY_BYTES, readJsonBody } from "@/lib/server/runApi";
import { CONTENT_SECURITY_POLICY, securityHeaders } from "@/lib/securityHeaders";

const TOKEN = "correct horse battery staple";
beforeEach(() => {
  process.env.ADMIN_TOKEN = TOKEN;
});

const DAY = 24 * 3600_000;

describe("admin session cookie", () => {
  it("is valid while it is fresh and stops working when it expires, even if the browser keeps sending it", () => {
    const now = 1_800_000_000_000;
    const value = sessionValue(now)!;
    expect(sessionValid(value, now + 1000)).toBe(true);
    expect(sessionValid(value, now + ADMIN_SESSION_SECONDS * 1000 - 1)).toBe(true);
    expect(sessionValid(value, now + ADMIN_SESSION_SECONDS * 1000 + 1)).toBe(false);
    expect(sessionValid(value, now + DAY)).toBe(false);
  });

  it("cannot be stretched: a changed expiry, a forged far-future expiry and junk are all refused", () => {
    const now = 1_800_000_000_000;
    const [exp, mac] = sessionValue(now)!.split(".");
    expect(sessionValid(`${Number(exp) + DAY}.${mac}`, now)).toBe(false); // longer expiry, same signature
    const forgedExp = String(now + 365 * DAY);
    const forged = createHmac("sha256", TOKEN).update(`foundry-admin-session:${forgedExp}`).digest("hex");
    expect(sessionValid(`${forgedExp}.${forged}`, now)).toBe(false); // correctly signed but absurdly long
    for (const junk of ["", "x", "1.2.3", `${exp}.`, `.${mac}`, "abc.def", `${exp}.${mac}x`, `-5.${mac}`]) {
      expect(sessionValid(junk, now)).toBe(false);
    }
  });

  it("dies when the admin token changes", () => {
    const value = sessionValue()!;
    process.env.ADMIN_TOKEN = "rotated";
    expect(sessionValid(value)).toBe(false);
  });
});

describe("cross-site protection on state-changing admin requests", () => {
  const post = (origin: string | null, host = "foundry.example") =>
    new Request("https://foundry.example/api/admin/actions", {
      method: "POST",
      headers: { host, ...(origin ? { origin } : {}) },
    });

  it("lets same-origin and header-less requests through and blocks other sites", () => {
    expect(blockCrossSite(post("https://foundry.example"))).toBeNull();
    expect(blockCrossSite(post(null))).toBeNull();
    expect(blockCrossSite(post("https://evil.example"))?.status).toBe(403);
    expect(blockCrossSite(post("https://foundry.example.evil.example"))?.status).toBe(403);
    expect(blockCrossSite(post("not a url"))?.status).toBe(403);
    expect(blockCrossSite(new Request("https://foundry.example/x", { method: "GET", headers: { origin: "https://evil.example" } }))).toBeNull();
  });

  it("applies to login and to the actions, before anything else is checked", async () => {
    const evil = { "content-type": "application/json", origin: "https://evil.example", host: "foundry.example" };
    const l = await login(new Request("https://foundry.example/api/admin/login", { method: "POST", headers: evil, body: JSON.stringify({ token: TOKEN }) }));
    expect(l.status).toBe(403);
    expect(l.headers.get("set-cookie")).toBeNull();
    const a = await actions(
      new Request("https://foundry.example/api/admin/actions", {
        method: "POST",
        headers: { ...evil, cookie: `foundry_admin=${sessionValue()}` },
        body: JSON.stringify({ action: "clear-log" }),
      }),
    );
    expect(a.status).toBe(403);
  });
});

describe("request body size cap", () => {
  const req = (body: string, headers: Record<string, string> = {}) =>
    new Request("http://t/x", { method: "POST", headers: { "content-type": "application/json", ...headers }, body });

  it("reads small JSON, and refuses invalid JSON and oversize bodies with the right status", async () => {
    expect(await readJsonBody(req('{"a":1}'))).toEqual({ ok: true, body: { a: 1 } });
    expect(await readJsonBody(req("{nope"))).toMatchObject({ ok: false, status: 400 });
    const big = JSON.stringify({ x: "a".repeat(MAX_BODY_BYTES) });
    expect(await readJsonBody(req(big))).toMatchObject({ ok: false, status: 413 });
    expect(await readJsonBody(req("{}", { "content-length": String(MAX_BODY_BYTES + 1) }))).toMatchObject({ ok: false, status: 413 });
  });

  it("counts bytes, not characters", async () => {
    const multi = JSON.stringify({ x: "é".repeat(MAX_BODY_BYTES / 2) }); // fewer characters than the cap, more bytes
    expect(await readJsonBody(req(multi))).toMatchObject({ ok: false, status: 413 });
  });
});

describe("security headers", () => {
  const map = (dev: boolean) => Object.fromEntries(securityHeaders(dev).map((h) => [h.key, h.value]));

  it("sends the standard set in production", () => {
    const h = map(false);
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["X-Frame-Options"]).toBe("DENY");
    expect(h["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["Permissions-Policy"]).toMatch(/camera=\(\)/);
    expect(h["Cross-Origin-Opener-Policy"]).toBe("same-origin");
    expect(h["Content-Security-Policy"]).toBe(CONTENT_SECURITY_POLICY);
  });

  it("locks the policy to the site itself: no framing, no plugins, no other origins", () => {
    for (const rule of ["default-src 'self'", "frame-ancestors 'none'", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "connect-src 'self'"]) {
      expect(CONTENT_SECURITY_POLICY).toContain(rule);
    }
    expect(CONTENT_SECURITY_POLICY).not.toMatch(/https?:\/\/|\*/); // no allowed outside hosts or wildcards
    expect(CONTENT_SECURITY_POLICY).not.toContain("unsafe-eval");
    expect(CONTENT_SECURITY_POLICY).toContain("img-src 'self' data: blob:"); // the browser screenshots arrive as data: images
  });

  it("leaves the policy out in development, where Next needs eval and websockets", () => {
    expect(map(true)["Content-Security-Policy"]).toBeUndefined();
    expect(map(true)["X-Content-Type-Options"]).toBe("nosniff");
  });
});
