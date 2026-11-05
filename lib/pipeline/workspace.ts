import { INTERFACE_FILES, LOGIC_FILES, STARTER_FILES } from "../starter";

// The agents' view of the app they are building: the starter kit (lib/starter.ts) with an overlay for the files
// the engineers write. Nothing touches disk, and no agent ever gets a shell, so a run cannot reach anything but
// this copy.

export const MAX_FILE_BYTES = 16_000;
export const MAX_WRITES = 10;
/** Where engineers may write. Everything else, including package.json and the README, is off limits. */
export const WRITABLE = [LOGIC_FILES, INTERFACE_FILES];
export const STARTER_SOURCE = { repo: "foundry starter kit", commit: "v1" };

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
  const base: Record<string, string> = STARTER_FILES;
  const overlay = new Map<string, string>();
  const all = () => ({ ...base, ...Object.fromEntries(overlay) });

  return {
    source: STARTER_SOURCE,

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
        throw new Error(`Not allowed to write ${p || "(empty path)"}. Allowed: app.js, tests/*.test.js, index.html, style.css, ui.js.`);
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
