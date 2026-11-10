// PostToolUse hook (Edit, Write, MultiEdit). Runs the project's Prettier on the one file
// Claude just changed. Files listed in .prettierignore (recordings, generated files, .claude)
// and file types Prettier does not know are skipped. Never blocks: on any problem it exits 0.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (c) => (raw += c));
process.stdin.on("end", () => {
  try {
    const e = JSON.parse(raw);
    const file = e.tool_input?.file_path;
    const root = process.env.CLAUDE_PROJECT_DIR || e.cwd;
    if (!file || !root) process.exit(0);
    const abs = resolve(root, file);
    const prettier = join(root, "node_modules", "prettier", "bin", "prettier.cjs");
    if (!existsSync(abs) || !existsSync(prettier)) process.exit(0);
    spawnSync(process.execPath, [prettier, "--write", "--ignore-unknown", abs], {
      cwd: root,
      stdio: "ignore",
      timeout: 20000,
    });
  } catch {
    // Formatting must never get in Claude's way.
  }
  process.exit(0);
});
