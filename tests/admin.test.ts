import { beforeEach, describe, expect, it } from "vitest";
import { POST as actions } from "@/app/api/admin/actions/route";
import { POST as login } from "@/app/api/admin/login/route";
import { GET as stats } from "@/app/api/admin/stats/route";
import { cookieFromHeader, sessionValid, sessionValue, tokenMatches } from "@/lib/server/adminAuth";
import { serverState } from "@/lib/server/state";

const TOKEN = "correct horse battery staple";

beforeEach(() => {
  process.env.ADMIN_TOKEN = TOKEN;
});

const json = (body: unknown, headers: Record<string, string> = {}) => ({
  method: "POST",
  headers: { "content-type": "application/json", ...headers },
  body: JSON.stringify(body),
});
const asAdmin = () => ({ cookie: `foundry_admin=${sessionValue()}` });

describe("admin auth helpers", () => {
  it("matches only the exact token, and nothing when no token is set", () => {
    expect(tokenMatches(TOKEN)).toBe(true);
    expect(tokenMatches(TOKEN + "x")).toBe(false);
    expect(tokenMatches("")).toBe(false);
    delete process.env.ADMIN_TOKEN;
    expect(tokenMatches("")).toBe(false);
    expect(sessionValue()).toBeNull();
  });

  it("accepts only the session value derived from the current token", () => {
    const value = sessionValue()!;
    expect(sessionValid(value)).toBe(true);
    expect(sessionValid(value.slice(0, -1) + (value.endsWith("a") ? "b" : "a"))).toBe(false);
    expect(sessionValid(undefined)).toBe(false);
    process.env.ADMIN_TOKEN = "rotated";
    expect(sessionValid(value)).toBe(false); // changing the token signs everyone out
  });

  it("reads a cookie out of a header", () => {
    expect(cookieFromHeader("a=1; foundry_admin=abc=; b=2")).toBe("abc=");
    expect(cookieFromHeader(null)).toBeUndefined();
  });
});

describe("POST /api/admin/login", () => {
  it("is a 404 when no admin token is configured", async () => {
    delete process.env.ADMIN_TOKEN;
    expect((await login(new Request("http://t/api/admin/login", json({ token: "x" })))).status).toBe(404);
  });

  it("sets an HTTP-only strict cookie for the right token", async () => {
    const res = await login(new Request("http://t/api/admin/login", json({ token: TOKEN })));
    expect(res.status).toBe(200);
    const cookie = res.headers.get("set-cookie")!;
    expect(cookie).toContain(`foundry_admin=${sessionValue()}`);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Strict/);
  });

  it("refuses a wrong token and locks the address out after five tries", async () => {
    const attempt = () => login(new Request("http://t/api/admin/login", json({ token: "nope" }, { "x-forwarded-for": "192.0.2.1" })));
    for (let i = 0; i < 5; i++) expect((await attempt()).status).toBe(401);
    expect((await attempt()).status).toBe(429);
    // even the right token is refused while locked out
    const right = await login(new Request("http://t/api/admin/login", json({ token: TOKEN }, { "x-forwarded-for": "192.0.2.1" })));
    expect(right.status).toBe(429);
  });
});

describe("GET /api/admin/stats", () => {
  const get = (headers: Record<string, string> = {}) => stats(new Request("http://t/api/admin/stats", { headers }));

  it("is hidden when disabled and closed to anyone not signed in", async () => {
    expect((await get()).status).toBe(401);
    expect((await get({ cookie: "foundry_admin=wrong" })).status).toBe(401);
    delete process.env.ADMIN_TOKEN;
    expect((await get()).status).toBe(404);
  });

  it("returns the log and the server settings to a signed-in admin", async () => {
    const res = await get(asAdmin());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.runs).toEqual([]);
    expect(body.server.limits).toMatchObject({ perHour: 3, perDay: 40, usedToday: 0 });
    expect(body.recorded).toHaveLength(3);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});

describe("POST /api/admin/actions", () => {
  const act = (action: unknown, headers = asAdmin()) => actions(new Request("http://t/api/admin/actions", json({ action }, headers)));

  it("requires a signed-in admin and a known action", async () => {
    expect((await act("pause-live", {} as never)).status).toBe(401);
    expect((await act("delete-everything")).status).toBe(400);
  });

  it("pauses and resumes live runs", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-test";
    let body = await (await act("pause-live")).json();
    expect(body.server).toMatchObject({ livePaused: true, liveEnabled: false, liveConfigured: true });
    body = await (await act("resume-live")).json();
    expect(body.server).toMatchObject({ livePaused: false, liveEnabled: true });
  });

  it("resets visitor limits and clears the log", async () => {
    const state = serverState();
    state.liveLimiter.check("a");
    state.runLog.add({
      id: "1", at: 1, request: "x", mode: "live", status: "approved", ms: 1, rounds: 1, costUsd: 0,
      inputTokens: 0, outputTokens: 0, agentMs: {}, visitor: "v",
    });
    expect((await (await act("reset-limits")).json()).server.limits.usedToday).toBe(0);
    expect((await (await act("clear-log")).json()).runs).toEqual([]);
  });
});
