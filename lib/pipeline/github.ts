import { createSign } from "node:crypto";
import snapshot from "../tasklySnapshot.json";

// Opens a real draft pull request on the public taskly-sample repo with the files the agents wrote.
// It signs in as a GitHub App that is installed on that one repository only, with permission to write
// contents and pull requests there and nothing else. The agents never see any credential: only this
// module does, and only after a run has passed its checks.
//
// Settings (Vercel env vars):
//   GITHUB_APP_ID, GITHUB_APP_INSTALLATION_ID, GITHUB_APP_PRIVATE_KEY (the .pem text, or its base64)

export type PullRequest = { url: string; number: number };

export type GithubClient = {
  /** Branch from the pinned commit, commit these files, open a draft pull request. */
  openPullRequest(input: { files: Record<string, string>; title: string; body: string; runId: string }): Promise<PullRequest>;
  /** Close pull requests opened by Foundry that are older than `maxAgeMs`, and delete their branches. */
  closeStale(maxAgeMs: number): Promise<{ closed: number }>;
};

export const BRANCH_PREFIX = "foundry/";
/** No new pull request while this many are open. A guard against spam and runaway runs. */
export const MAX_OPEN_PULLS = 12;
export const STALE_AFTER_MS = 24 * 3600_000;
/** A pull request with this label is never closed by the cleanup. Added by hand, to keep one example open. */
export const KEEP_OPEN_LABEL = "keep-open";

const API = "https://api.github.com";
const REPO = snapshot.repo;

export function githubConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.GITHUB_APP_ID?.trim() && env.GITHUB_APP_INSTALLATION_ID?.trim() && env.GITHUB_APP_PRIVATE_KEY?.trim());
}

const b64url = (b: Buffer | string) => Buffer.from(b).toString("base64url");

/** The private key as PEM text, whether it was stored as PEM (with real or escaped newlines) or as base64 of the PEM. */
export function readPrivateKey(raw: string): string {
  const v = raw.trim();
  if (v.includes("BEGIN")) return v.replace(/\\n/g, "\n");
  return Buffer.from(v, "base64").toString("utf8");
}

/** A short-lived JSON Web Token that proves we are the app. */
export function appJwt(appId: string, pem: string, nowSec = Math.floor(Date.now() / 1000)): string {
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify({ iat: nowSec - 30, exp: nowSec + 9 * 60, iss: appId }));
  const sig = createSign("RSA-SHA256").update(`${header}.${payload}`).sign(pem);
  return `${header}.${payload}.${b64url(sig)}`;
}

/** Make a pull request title and body from the Release agent's text, with the visitor-facing footer. */
export function formatPullRequest(releaseText: string, request: string): { title: string; body: string } {
  const clean = (s: string) => s.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").trim();
  const lines = clean(releaseText).split("\n");
  const first = lines.find((l) => l.trim()) ?? "";
  const title = first.replace(/^[#*\s>-]+/, "").replace(/^(title|pr title)\s*:\s*/i, "").replace(/[*`]/g, "").trim().slice(0, 110) || "Change from Foundry";
  const rest = lines.slice(lines.indexOf(first) + 1).join("\n").trim().slice(0, 3000);
  const body = [
    rest,
    "---",
    `Request: ${clean(request).slice(0, 200)}`,
    "",
    "Opened automatically by [Foundry](https://alexmarushka.vercel.app) for a visitor. The code was written by AI agents. Its unit tests and a browser test ran in an isolated sandbox. **No human has reviewed it.** It is a draft on a throwaway sample app and is closed automatically after about a day.",
  ]
    .filter((l) => l !== undefined)
    .join("\n");
  return { title, body };
}

type Fetch = typeof fetch;

export function createGithubClient(opts: { env?: NodeJS.ProcessEnv; fetch?: Fetch; now?: () => number } = {}): GithubClient {
  const env = opts.env ?? process.env;
  const doFetch: Fetch = opts.fetch ?? fetch;
  const now = opts.now ?? Date.now;

  async function call<T>(method: string, path: string, auth: string, body?: unknown): Promise<T> {
    const res = await doFetch(`${API}${path}`, {
      method,
      headers: {
        Authorization: auth,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "foundry-portfolio",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = (await res.text().catch(() => "")).slice(0, 160);
      throw new Error(`GitHub ${method} ${path.split("?")[0].replace(/\/\d+/g, "/:n")} failed (${res.status}) ${text}`.trim());
    }
    return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
  }

  async function installationToken(): Promise<string> {
    const jwt = appJwt(env.GITHUB_APP_ID!.trim(), readPrivateKey(env.GITHUB_APP_PRIVATE_KEY!), Math.floor(now() / 1000));
    const r = await call<{ token: string }>("POST", `/app/installations/${env.GITHUB_APP_INSTALLATION_ID!.trim()}/access_tokens`, `Bearer ${jwt}`);
    return r.token;
  }

  return {
    async openPullRequest({ files, title, body, runId }) {
      const entries = Object.entries(files);
      if (entries.length === 0) throw new Error("No files to commit.");
      const auth = `Bearer ${await installationToken()}`;

      const open = await call<unknown[]>("GET", `/repos/${REPO}/pulls?state=open&per_page=50`, auth);
      if (open.length >= MAX_OPEN_PULLS) throw new Error("Too many pull requests are open right now.");

      const base = await call<{ tree: { sha: string } }>("GET", `/repos/${REPO}/git/commits/${snapshot.commit}`, auth);
      const tree = await call<{ sha: string }>("POST", `/repos/${REPO}/git/trees`, auth, {
        base_tree: base.tree.sha,
        tree: entries.map(([path, content]) => ({ path, mode: "100644", type: "blob", content })),
      });
      const commit = await call<{ sha: string }>("POST", `/repos/${REPO}/git/commits`, auth, {
        message: `${title}\n\nGenerated by Foundry agents. Not reviewed by a human.`,
        tree: tree.sha,
        parents: [snapshot.commit],
      });
      const branch = `${BRANCH_PREFIX}${runId}`;
      await call("POST", `/repos/${REPO}/git/refs`, auth, { ref: `refs/heads/${branch}`, sha: commit.sha });
      const pr = await call<{ html_url: string; number: number }>("POST", `/repos/${REPO}/pulls`, auth, {
        title,
        head: branch,
        base: "main",
        body,
        draft: true,
      });
      return { url: pr.html_url, number: pr.number };
    },

    async closeStale(maxAgeMs) {
      const auth = `Bearer ${await installationToken()}`;
      const open = await call<Array<{ number: number; created_at: string; head: { ref: string }; labels?: Array<{ name: string }> }>>(
        "GET",
        `/repos/${REPO}/pulls?state=open&per_page=100`,
        auth,
      );
      let closed = 0;
      for (const pr of open) {
        if (!pr.head.ref.startsWith(BRANCH_PREFIX)) continue;
        if (pr.labels?.some((l) => l.name === KEEP_OPEN_LABEL)) continue;
        if (now() - Date.parse(pr.created_at) < maxAgeMs) continue;
        await call("PATCH", `/repos/${REPO}/pulls/${pr.number}`, auth, { state: "closed" });
        await call("DELETE", `/repos/${REPO}/git/refs/heads/${pr.head.ref}`, auth).catch(() => {});
        closed += 1;
      }
      return { closed };
    },
  };
}
