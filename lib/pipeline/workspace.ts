import snapshot from "../tasklySnapshot.json";

// The agents' view of the sample app. For now it is an in-memory copy of the taskly-sample repo
// (lib/tasklySnapshot.json) with an overlay for the files the engineers write. Nothing touches disk, and
// no agent ever gets a shell, so a run cannot reach anything but this copy. A later stage swaps the
// implementation for a real sandbox without changing the tools.

export const MAX_FILE_BYTES = 8_000;
export const MAX_WRITES = 12;
/** Where engineers may write. Everything else, including package.json and config, is off limits. */
export const WRITABLE = [/^src\/[\w./-]+\.js$/, /^public\/[\w./-]+\.(js|css|html)$/, /^tests\/[\w./-]+\.js$/];

export interface Workspace {
  /** Repository name and commit the copy was taken from. */
  readonly source: { repo: string; commit: string };
  listDir(dir: string): string[];
  read(path: string): string | null;
  grep(pattern: string): string[];
  /** Throws a short message the agent can read when the write is not allowed. */
  write(path: string, content: string): void;
  /** Files written so far, as { path: content }. */
  changes(): Record<string, string>;
}

const norm = (p: string) => p.replace(/\\/g, "/").replace(/^\.?\/+/, "").replace(/\/+$/, "");
const safe = (p: string) => !p.split("/").some((part) => part === ".." || part === "") && !p.includes("\0");

export function createWorkspace(): Workspace {
  const base: Record<string, string> = snapshot.files;
  const overlay = new Map<string, string>();
  const all = () => ({ ...base, ...Object.fromEntries(overlay) });

  return {
    source: { repo: snapshot.repo, commit: snapshot.commit },

    listDir(dir) {
      const d = norm(dir);
      const prefix = d === "" || d === "." ? "" : `${d}/`;
      const names = new Set<string>();
      for (const path of Object.keys(all())) {
        if (!path.startsWith(prefix)) continue;
        const rest = path.slice(prefix.length);
        const slash = rest.indexOf("/");
        names.add(slash < 0 ? rest : `${rest.slice(0, slash)}/`);
      }
      return [...names].sort();
    },

    read(path) {
      const p = norm(path);
      return safe(p) ? (all()[p] ?? null) : null;
    },

    grep(pattern) {
      let re: RegExp;
      try {
        re = new RegExp(pattern, "i");
      } catch {
        re = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      }
      const hits: string[] = [];
      for (const [path, body] of Object.entries(all()).sort(([a], [b]) => a.localeCompare(b))) {
        body.split("\n").forEach((line, i) => {
          if (re.test(line)) hits.push(`${path}:${i + 1}: ${line.trim().slice(0, 160)}`);
        });
      }
      return hits.slice(0, 40);
    },

    write(path, content) {
      const p = norm(path);
      if (!safe(p) || !WRITABLE.some((re) => re.test(p))) {
        throw new Error(`Not allowed to write ${p || "(empty path)"}. Allowed: src/*.js, public/*.js|css|html, tests/*.js.`);
      }
      if (Buffer.byteLength(content) > MAX_FILE_BYTES) throw new Error(`File too large (limit ${MAX_FILE_BYTES} bytes).`);
      if (!overlay.has(p) && overlay.size >= MAX_WRITES) throw new Error(`Too many files written (limit ${MAX_WRITES}).`);
      overlay.set(p, content);
    },

    changes() {
      return Object.fromEntries(overlay);
    },
  };
}
