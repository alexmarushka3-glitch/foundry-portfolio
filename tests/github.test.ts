import { createVerify, generateKeyPairSync } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import snapshot from "@/lib/tasklySnapshot.json";
import {
  BRANCH_PREFIX,
  MAX_OPEN_PULLS,
  STALE_AFTER_MS,
  appJwt,
  createGithubClient,
  formatPullRequest,
  githubConfigured,
  readPrivateKey,
} from "@/lib/pipeline/github";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

const ENV = { GITHUB_APP_ID: "123", GITHUB_APP_INSTALLATION_ID: "456", GITHUB_APP_PRIVATE_KEY: privateKey } as unknown as NodeJS.ProcessEnv;

describe("githubConfigured", () => {
  it("needs all three settings", () => {
    expect(githubConfigured(ENV)).toBe(true);
    expect(githubConfigured({ ...ENV, GITHUB_APP_ID: " " } as NodeJS.ProcessEnv)).toBe(false);
    expect(githubConfigured({} as NodeJS.ProcessEnv)).toBe(false);
  });
});

describe("private key and app token", () => {
  it("reads the key as PEM, PEM with escaped newlines, or base64", () => {
    expect(readPrivateKey(privateKey)).toBe(privateKey.trim());
    expect(readPrivateKey(privateKey.trim().replace(/\n/g, "\\n"))).toBe(privateKey.trim());
    expect(readPrivateKey(Buffer.from(privateKey).toString("base64") + "\n")).toBe(privateKey);
  });

  it("signs a short-lived RS256 token that the public key verifies", () => {
    const jwt = appJwt("123", privateKey, 1_000_000);
    const [h, p, s] = jwt.split(".");
    expect(JSON.parse(Buffer.from(h, "base64url").toString())).toEqual({ alg: "RS256", typ: "JWT" });
    const payload = JSON.parse(Buffer.from(p, "base64url").toString());
    expect(payload).toEqual({ iat: 999_970, exp: 1_000_540, iss: "123" });
    expect(createVerify("RSA-SHA256").update(`${h}.${p}`).verify(publicKey, Buffer.from(s, "base64url"))).toBe(true);
  });
});

describe("formatPullRequest", () => {
  it("takes the first line as a clean title and keeps the rest, plus a footer saying no human reviewed it", () => {
    const { title, body } = formatPullRequest("**Title:** Add due date\u0007 to tasks\n\n- Data: x\n- API: y", 'Add a "due date" field.');
    expect(title).toBe("Add due date to tasks");
    expect(body).toContain("- Data: x");
    expect(body).toContain('Request: Add a "due date" field.');
    expect(body).toMatch(/No human has reviewed it/);
    expect(body).toMatch(/closed automatically/);
  });

  it("caps the title and survives empty text", () => {
    expect(formatPullRequest("x".repeat(500), "r").title.length).toBeLessThanOrEqual(110);
    expect(formatPullRequest("", "r").title).toBe("Change from Foundry");
  });
});

/** A fake GitHub: records calls and answers each by method and path. */
function fakeGithub(answer: (method: string, path: string, body: unknown) => unknown) {
  const calls: Array<{ method: string; path: string; body: unknown; auth: string }> = [];
  const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
    const path = url.replace("https://api.github.com", "");
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method: init.method!, path, body, auth: String((init.headers as Record<string, string>).Authorization) });
    const out = answer(init.method!, path, body);
    if (out instanceof Response) return out;
    return out === undefined ? new Response(null, { status: 204 }) : Response.json(out);
  });
  return { calls, fetch: fetchMock as unknown as typeof fetch };
}

const REPO = snapshot.repo;

describe("openPullRequest", () => {
  const happy = (method: string, path: string) => {
    if (path.endsWith("/access_tokens")) return { token: "ghs_installation" };
    if (method === "GET" && path.includes("/pulls")) return [];
    if (path.includes("/git/commits/")) return { tree: { sha: "basetree" } };
    if (path.endsWith("/git/trees")) return { sha: "newtree" };
    if (path.endsWith("/git/commits")) return { sha: "newcommit" };
    if (path.endsWith("/git/refs")) return {};
    if (path.endsWith("/pulls")) return { html_url: `https://github.com/${REPO}/pull/7`, number: 7 };
    throw new Error(`unexpected ${method} ${path}`);
  };

  it("branches from the pinned commit, commits only the given files, and opens a draft pull request", async () => {
    const gh = fakeGithub(happy);
    const client = createGithubClient({ env: ENV, fetch: gh.fetch });
    const pr = await client.openPullRequest({ files: { "src/db.js": "// new" }, title: "T", body: "B", runId: "abc" });
    expect(pr).toEqual({ url: `https://github.com/${REPO}/pull/7`, number: 7 });

    const byPath = (suffix: string, method = "POST") => gh.calls.find((c) => c.method === method && c.path.endsWith(suffix))!;
    expect(byPath("/access_tokens").auth).toMatch(/^Bearer ey/); // the app's token, to get an installation token
    expect(byPath("/git/trees").auth).toBe("Bearer ghs_installation");
    expect(byPath("/git/trees").body).toEqual({
      base_tree: "basetree",
      tree: [{ path: "src/db.js", mode: "100644", type: "blob", content: "// new" }],
    });
    expect(byPath("/git/commits").body).toMatchObject({ tree: "newtree", parents: [snapshot.commit] });
    expect(byPath("/git/refs").body).toEqual({ ref: `refs/heads/${BRANCH_PREFIX}abc`, sha: "newcommit" });
    expect(byPath("/pulls").body).toEqual({ title: "T", head: `${BRANCH_PREFIX}abc`, base: "main", body: "B", draft: true });
    // everything stays inside the one repository
    expect(gh.calls.filter((c) => c.path.startsWith("/repos/")).every((c) => c.path.startsWith(`/repos/${REPO}/`))).toBe(true);
  });

  it("refuses when too many pull requests are open, or there is nothing to commit", async () => {
    const full = fakeGithub((m, p) => (m === "GET" && p.includes("/pulls") ? Array.from({ length: MAX_OPEN_PULLS }, () => ({})) : happy(m, p)));
    await expect(createGithubClient({ env: ENV, fetch: full.fetch }).openPullRequest({ files: { "src/a.js": "x" }, title: "T", body: "B", runId: "a" })).rejects.toThrow(/Too many/);
    expect(full.calls.some((c) => c.path.endsWith("/git/trees"))).toBe(false);
    await expect(createGithubClient({ env: ENV, fetch: fakeGithub(happy).fetch }).openPullRequest({ files: {}, title: "T", body: "B", runId: "a" })).rejects.toThrow(/No files/);
  });

  it("reports GitHub errors briefly, without the token", async () => {
    const gh = fakeGithub((m, p) => (p.endsWith("/git/trees") ? new Response("nope", { status: 422 }) : happy(m, p)));
    const err = await createGithubClient({ env: ENV, fetch: gh.fetch })
      .openPullRequest({ files: { "src/a.js": "x" }, title: "T", body: "B", runId: "a" })
      .catch((e: Error) => e);
    expect((err as Error).message).toMatch(/422/);
    expect((err as Error).message).not.toMatch(/ghs_|Bearer/);
  });
});

describe("closeStale", () => {
  it("closes only Foundry's old pull requests and deletes their branches", async () => {
    const now = Date.parse("2026-10-27T12:00:00Z");
    const hours = (h: number) => new Date(now - h * 3600_000).toISOString();
    const gh = fakeGithub((method, path) => {
      if (path.endsWith("/access_tokens")) return { token: "t" };
      if (method === "GET")
        return [
          { number: 1, created_at: hours(30), head: { ref: `${BRANCH_PREFIX}old` } },
          { number: 2, created_at: hours(2), head: { ref: `${BRANCH_PREFIX}new` } },
          { number: 3, created_at: hours(99), head: { ref: "someone-elses-branch" } },
        ];
      return method === "DELETE" ? undefined : {};
    });
    const res = await createGithubClient({ env: ENV, fetch: gh.fetch, now: () => now }).closeStale(STALE_AFTER_MS);
    expect(res).toEqual({ closed: 1 });
    const mutations = gh.calls.filter((c) => c.method === "PATCH" || c.method === "DELETE").map((c) => `${c.method} ${c.path.replace(`/repos/${REPO}`, "")}`);
    expect(mutations).toEqual([`PATCH /pulls/1`, `DELETE /git/refs/heads/${BRANCH_PREFIX}old`]);
  });
});
