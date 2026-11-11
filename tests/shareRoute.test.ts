import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET as serveApp } from "@/app/a/[id]/app/route";
import { GET as serveWrapper } from "@/app/a/[id]/route";
import { GET as serveOther } from "@/app/a/[[...rest]]/route";
import { GET as available, POST as create } from "@/app/api/share/route";
import {
  SHARED_APP_CONTENT_SECURITY_POLICY,
  SHARED_WRAPPER_CONTENT_SECURITY_POLICY,
} from "@/lib/securityHeaders";
import { MemoryShareBrake, RedisShareBrake } from "@/lib/server/shareBrake";
import { HmacShareSigner } from "@/lib/server/shareSigner";
import { RedisShareStore } from "@/lib/server/shareStore";
import { bundleApp } from "@/lib/bundle";
import recordings from "@/lib/liveRecordings.json";
import { resetServerState, serverState } from "@/lib/server/state";
import { MAX_SHARE_BYTES, SHARE_TTL_SECONDS } from "@/lib/share";
import { fakeUpstash } from "./fixtures/fakeUpstash";

const APP =
  "<!doctype html><html><head><title>Tip calculator</title></head><body><h1>Tip</h1><script>localStorage.setItem('a','1')</script></body></html>";

const signer = new HmacShareSigner(async () => Buffer.alloc(32, 7));

let fake: ReturnType<typeof fakeUpstash>;
beforeEach(async () => {
  resetServerState();
  fake = fakeUpstash();
  const state = serverState();
  state.shares = new RedisShareStore(fake.config);
  state.shareBrake = new MemoryShareBrake({ perHour: 3, perDay: 100 });
  state.shareSigner = signer;
  await signer.prepare();
});
afterEach(() => {
  delete process.env.FOUNDRY_SHARE;
});

const post = (body: unknown, headers: Record<string, string> = {}) =>
  create(
    new Request("https://foundry.example/api/share", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.5", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
/** Posts an app the way the page does: its files, and the server's signature for them. */
const postApp = (html: string, headers: Record<string, string> = {}) => {
  const files = { "index.html": html };
  return post({ files, sig: signer.sign(files) }, headers);
};
/** The apps in the shipped recordings. */
const shipped = (
  recordings as unknown as {
    recordings: { events: { event: { type: string; files?: Record<string, string> } }[] }[];
  }
).recordings.map((r) => r.events.find((e) => e.event.type === "files")!.event.files!);

/** The app page as the browser asks for it inside the wrapper's frame. */
const open = (id: string, dest = "iframe") =>
  serveApp(
    new Request(`https://foundry.example/a/${id}/app`, { headers: { "sec-fetch-dest": dest } }),
    { params: Promise.resolve({ id }) },
  );
const openWrapper = (id: string) =>
  serveWrapper(new Request(`https://foundry.example/a/${id}`), { params: Promise.resolve({ id }) });

describe("GET /api/share", () => {
  it("says links are available when the database is connected, and not otherwise", async () => {
    expect(await (await available()).json()).toEqual({ available: true });
    resetServerState();
    expect(await (await available()).json()).toEqual({ available: false });
  });
});

describe("POST /api/share", () => {
  it("keeps the app for 7 days and returns a link on this site", async () => {
    const res = await postApp(APP);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await res.json();
    expect(body.url).toBe(`https://foundry.example/a/${body.id}`);
    expect(body.id).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(new Date(body.expiresAt).getTime() - Date.now()).toBeGreaterThan(
      (SHARE_TTL_SECONDS - 60) * 1000,
    );
    expect(fake.ttls.get(`foundry:app:${body.id}`)).toBe(SHARE_TTL_SECONDS);
  });

  it("refuses when the database is not connected", async () => {
    resetServerState();
    expect((await postApp(APP)).status).toBe(503);
  });

  it("refuses something that is not a finished page, and a body that is not JSON", async () => {
    expect((await post({ files: "hello" })).status).toBe(400);
    expect((await post({ files: 42 })).status).toBe(400);
    expect((await post({ files: {} })).status).toBe(400);
    expect((await post({ files: { "index.html": 42 } })).status).toBe(400);
    expect((await post({ files: { ["x".repeat(500)]: "a" } })).status).toBe(400);
    expect((await post({ html: APP })).status).toBe(400); // the old shape, with no files
    expect((await post({})).status).toBe(400);
    expect((await post("not json")).status).toBe(400);
  });

  it("accepts an app just under the cap even when its quotes and line breaks double its size as JSON", async () => {
    const body = '"\n'.repeat(Math.floor((MAX_SHARE_BYTES - 400) / 2));
    const res = await postApp(`<!doctype html><html><body><!--${body}--></body></html>`);
    expect(res.status).toBe(200);
  });

  it("gives the slot back when the app could not be saved", async () => {
    const state = serverState();
    state.shareBrake = new RedisShareBrake({ perHour: 1, perDay: 1 }, fake.config);
    state.shares = new RedisShareStore({
      url: "https://redis.test",
      token: "t",
      fetchFn: (async () => new Response("no", { status: 500 })) as unknown as typeof fetch,
    });
    expect((await postApp(APP)).status).toBe(503);
    // the slot came back, so the next try is not told "paused for today" or "made 1 link this hour"
    state.shares = new RedisShareStore(fake.config);
    expect((await postApp(APP)).status).toBe(200);
  });

  it("refuses an app over the size cap", async () => {
    const big = `<!doctype html><html><body>${"x".repeat(MAX_SHARE_BYTES)}</body></html>`;
    expect((await postApp(big)).status).toBe(413);
  });

  it("refuses a page that fails the content check, in plain words", async () => {
    const res = await postApp("<!doctype html><html><body><input type='password'></body></html>");
    expect(res.status).toBe(422);
    expect((await res.json()).error).toMatch(/can't get a link because it asks for a password/);
    expect(fake.data.size).toBe(0);
  });

  it("limits links per address, and another address is not affected", async () => {
    for (let i = 0; i < 3; i++) expect((await postApp(APP)).status).toBe(200);
    const refused = await postApp(APP);
    expect(refused.status).toBe(429);
    expect((await refused.json()).error).toMatch(/3 links this hour/);
    expect((await postApp(APP, { "x-forwarded-for": "198.51.100.7" })).status).toBe(200);
  });

  it("blocks a request that a browser says came from another site", async () => {
    const res = await postApp(APP, { origin: "https://evil.example", host: "foundry.example" });
    expect(res.status).toBe(403);
  });

  it("says it could not make a link when the database fails, and keeps nothing half-saved", async () => {
    const state = serverState();
    state.shares = new RedisShareStore({
      url: "https://redis.test",
      token: "t",
      fetchFn: (async () => new Response("no", { status: 500 })) as unknown as typeof fetch,
    });
    const res = await postApp(APP);
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/Try Save the app/);
    expect(fake.data.size).toBe(0);
  });
});

describe("POST /api/share only takes apps that came from a Foundry run", () => {
  it("refuses files that carry no signature, a wrong one, or one for other files", async () => {
    const files = { "index.html": APP };
    for (const sig of [
      undefined,
      "",
      "nope",
      "0".repeat(64),
      signer.sign({ "index.html": "<h1>Other</h1>" }),
    ]) {
      const res = await post({ files, sig });
      expect(res.status).toBe(403);
      expect((await res.json()).error).toMatch(/Only apps built here on Foundry/);
    }
    expect(fake.data.size).toBe(0); // no page was stored
  });

  it("refuses a signature made with another key, and a page changed after it was signed", async () => {
    const other = new HmacShareSigner(async () => Buffer.alloc(32, 9));
    await other.prepare();
    const files = { "index.html": APP };
    expect((await post({ files, sig: other.sign(files) })).status).toBe(403);
    const tampered = { "index.html": APP.replace("Tip", "Free money") };
    expect((await post({ files: tampered, sig: signer.sign(files) })).status).toBe(403);
  });

  it("takes the same files in any order, because the signature covers their content", async () => {
    const a = { "app.js": "1", "index.html": APP };
    const b = { "index.html": APP, "app.js": "1" };
    expect((await post({ files: b, sig: signer.sign(a) })).status).toBe(200);
  });

  it("builds the page itself from the files, so the stored page is never text the client chose", async () => {
    const res = await postApp(APP);
    const { id } = await res.json();
    const stored = String(fake.data.get(`foundry:app:${id}`));
    expect(stored).toBe(bundleApp({ "index.html": APP }));
    expect(stored).toContain("Built by Foundry's AI agents");
  });

  it("accepts each shipped recording's app with no signature", async () => {
    expect(shipped).toHaveLength(3);
    for (const files of shipped) expect((await post({ files })).status).toBe(200);
  });

  it("does not accept a shipped app with one character changed", async () => {
    const files = { ...shipped[0], "index.html": `${shipped[0]["index.html"] ?? ""} ` };
    expect((await post({ files })).status).toBe(403);
  });

  it("says it could not make a link, not that the app is foreign, when the signing key cannot be loaded", async () => {
    const down = new HmacShareSigner(async () => {
      throw new Error("database down");
    });
    serverState().shareSigner = down;
    const res = await postApp(APP);
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/Try Save the app/);
  });
});

describe("the off switch (FOUNDRY_SHARE=off)", () => {
  it("stops offering links, stops making them, and stops opening the ones that exist", async () => {
    const id = (await (await postApp(APP)).json()).id as string;
    expect((await open(id)).status).toBe(200);
    process.env.FOUNDRY_SHARE = "off";
    expect(await (await available()).json()).toEqual({ available: false });
    expect((await postApp(APP)).status).toBe(503);
    const opened = await open(id);
    expect(opened.status).toBe(503);
    expect(await opened.text()).toContain("switched off");
    expect(opened.headers.get("content-security-policy")).toBe(SHARED_APP_CONTENT_SECURITY_POLICY);
    process.env.FOUNDRY_SHARE = " OFF ";
    expect((await open(id)).status).toBe(503); // any case, with spaces
    process.env.FOUNDRY_SHARE = "on";
    expect((await open(id)).status).toBe(200); // anything but "off" leaves links on
  });
});

describe("GET /a/[id] (the page a link opens)", () => {
  it("is the site's own page with one frame onto the sealed app, and a lock on what the frame may load", async () => {
    const id = "B".repeat(22);
    const res = await openWrapper(id);
    expect(res.status).toBe(200);
    const csp = res.headers.get("content-security-policy")!;
    expect(csp).toBe(SHARED_WRAPPER_CONTENT_SECURITY_POLICY);
    expect(csp).toContain("frame-src 'self'"); // an app that tries to leave for another website is stopped here
    expect(csp).toContain("frame-ancestors 'none'");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
    expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    const html = await res.text();
    expect(html).toContain(`<iframe src="/a/${id}/app"`);
    expect(html).toContain('sandbox="allow-scripts allow-forms allow-modals"');
    expect(html).not.toContain("allow-same-origin");
    expect(html).not.toContain("<script"); // only the site's own markup, no code of its own
  });

  it("asks the database nothing, and answers an id that could never be a link with a plain 404", async () => {
    const before = fake.fetchFn.mock.calls.length;
    await openWrapper("B".repeat(22));
    for (const id of ["short", "../../etc/passwd", "a".repeat(40), "%00"]) {
      const res = await openWrapper(id);
      expect(res.status).toBe(404);
      expect(res.headers.get("content-security-policy")).toBe(
        SHARED_WRAPPER_CONTENT_SECURITY_POLICY,
      );
      expect(await res.text()).not.toContain("<iframe");
    }
    expect(fake.fetchFn.mock.calls.length).toBe(before);
  });
});

describe("anything else under /a/", () => {
  it("answers with a plain 404 that still carries the sealed headers", async () => {
    const res = await serveOther();
    expect(res.status).toBe(404);
    expect(res.headers.get("content-security-policy")).toBe(SHARED_WRAPPER_CONTENT_SECURITY_POLICY);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await res.text()).not.toContain("<iframe");
  });

  it("lets the wrapper's frame use the clipboard even though the app has an opaque origin", async () => {
    expect(await (await openWrapper("B".repeat(22))).text()).toContain('allow="clipboard-write *"');
  });
});

describe("GET /a/[id]/app (the sealed app)", () => {
  const idOf = async () => (await (await postApp(APP)).json()).id as string;

  it("serves the app with the sealed headers and the storage stand-in, to a frame", async () => {
    const res = await open(await idOf());
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(res.headers.get("content-security-policy")).toBe(SHARED_APP_CONTENT_SECURITY_POLICY);
    expect(res.headers.get("content-security-policy")).not.toContain("allow-same-origin");
    expect(res.headers.get("content-security-policy")).toContain("frame-ancestors 'self'");
    expect(res.headers.get("x-frame-options")).toBe("SAMEORIGIN");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("vary")).toBe("Sec-Fetch-Dest");
    const html = await res.text();
    expect(html).toContain("<h1>Tip</h1>");
    expect(html.indexOf("new Map()")).toBeLessThan(html.indexOf("localStorage.setItem"));
  });

  it("sends anything that is not a frame to the wrapper, so the lock cannot be skipped", async () => {
    const id = await idOf();
    for (const dest of ["document", "script", "", "empty"]) {
      const res = await open(id, dest);
      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toBe(`/a/${id}`);
      expect(await res.text()).toBe("");
      expect(res.headers.get("vary")).toBe("Sec-Fetch-Dest");
    }
    // and with no header at all (an old browser)
    const bare = await serveApp(new Request(`https://foundry.example/a/${id}/app`), {
      params: Promise.resolve({ id }),
    });
    expect(bare.status).toBe(302);
  });

  it("answers an unknown, malformed or expired id with the same sealed 404, without asking the database for bad ids", async () => {
    const before = fake.fetchFn.mock.calls.length;
    for (const id of ["short", "../../etc/passwd", "a".repeat(40), "%00"]) {
      const res = await open(id);
      expect(res.status).toBe(404);
      expect(res.headers.get("content-security-policy")).toBe(SHARED_APP_CONTENT_SECURITY_POLICY);
    }
    expect(fake.fetchFn.mock.calls.length).toBe(before);
    const unknown = await open("A".repeat(22));
    expect(unknown.status).toBe(404);
    expect(await unknown.text()).toContain("expired or was never saved");
  });

  it("stops serving, and removes, a stored page that now breaks the rules", async () => {
    const id = await idOf();
    fake.data.set(
      `foundry:app:${id}`,
      "<!doctype html><html><body><form action='https://evil.example'></form></body></html>",
    );
    expect((await open(id)).status).toBe(404);
    expect(fake.data.has(`foundry:app:${id}`)).toBe(false);
  });

  it("says so, with 503, when the database is down", async () => {
    const id = await idOf();
    serverState().shares = new RedisShareStore({
      url: "https://redis.test",
      token: "t",
      fetchFn: (async () => new Response("no", { status: 500 })) as unknown as typeof fetch,
    });
    expect((await open(id)).status).toBe(503);
  });
});
