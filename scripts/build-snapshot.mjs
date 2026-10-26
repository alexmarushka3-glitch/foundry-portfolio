// Copies the taskly-sample repo (tracked files, current commit) into lib/tasklySnapshot.json.
// The agents read and edit this snapshot in memory. Run after taskly-sample changes:
//   node scripts/build-snapshot.mjs [path-to-taskly-sample]
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const repo = resolve(process.argv[2] ?? join(root, "..", "taskly-sample"));
const git = (...args) => execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();

if (git("status", "--porcelain")) {
  console.error("taskly-sample has uncommitted changes. Commit them first so the snapshot names a real commit.");
  process.exit(1);
}

const SKIP = new Set(["package-lock.json"]);
const files = {};
for (const path of git("ls-files").split("\n").filter(Boolean)) {
  if (SKIP.has(path)) continue;
  files[path] = readFileSync(join(repo, path), "utf8").replace(/\r\n/g, "\n");
}

const snapshot = { repo: "alexmarushka3-glitch/taskly-sample", commit: git("rev-parse", "HEAD"), files };
writeFileSync(join(root, "lib", "tasklySnapshot.json"), JSON.stringify(snapshot, null, 2) + "\n");
console.log(`snapshot of ${Object.keys(files).length} files at ${snapshot.commit.slice(0, 7)}`);
