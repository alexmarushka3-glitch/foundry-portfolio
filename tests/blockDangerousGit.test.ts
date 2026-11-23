// Feeds sample Bash commands to the PreToolUse hook (.claude/hooks/block-dangerous-git.mjs) the
// way Claude Code does, and checks the verdict: allow, ask (a permission prompt) or block.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const HOOK = fileURLToPath(new URL("../.claude/hooks/block-dangerous-git.mjs", import.meta.url));

type Verdict = { kind: "allow" | "ask" | "block"; reason?: string };

function run(stdin: string): Verdict {
  const r = spawnSync(process.execPath, [HOOK], { input: stdin, encoding: "utf8", cwd: ROOT });
  if (r.status === 2) return { kind: "block", reason: r.stderr };
  expect(r.status).toBe(0);
  const out = r.stdout.trim();
  if (!out) return { kind: "allow" };
  const parsed = JSON.parse(out);
  const hso = parsed.hookSpecificOutput;
  expect(hso.hookEventName).toBe("PreToolUse");
  return { kind: hso.permissionDecision, reason: hso.permissionDecisionReason };
}

const verdict = (command: string): Verdict =>
  run(JSON.stringify({ tool_input: { command }, cwd: ROOT }));

const ALLOW = [
  "git status",
  "git push -u origin feature/x",
  'git commit -m "run gh pr merge later"',
  "echo gh pr merge",
  "gh pr create --title t --body-file f",
  "gh pr view 40",
  "gh pr checks 40",
  "gh api repos/o/r/pulls",
  "gh api -X GET repos/o/r",
  "gh api -X POST repos/o/r/issues",
  "npm test",
];

const ASK = [
  "gh pr merge 40 --merge",
  "gh pr merge 40 --merge --delete-branch",
  "gh pr merge -R o/r 5",
  "gh pr -R o/r merge 5",
  "gh repo delete o/r --yes",
  "gh api -X DELETE repos/o/r/git/refs/heads/x",
  "gh api repos/o/r/git/refs/heads/x -X DELETE",
  "gh api --method DELETE repos/o/r",
  "gh api --method=delete repos/o/r",
  "gh api -XDELETE repos/o/r",
  "cd x && gh pr merge 1",
  "GH_TOKEN=t gh pr merge 1",
  "gh.exe pr merge 1",
];

// Existing git rules: these must keep blocking (exit 2).
const BLOCK = [
  "git push origin main",
  "git push --force origin x",
  "git push --delete origin x",
  "git push origin HEAD",
  "git reset --hard",
  "git clean -fd",
  "git branch -D x",
  "git checkout .",
  "git stash drop",
];

describe("block-dangerous-git hook", () => {
  it.each(ALLOW)("allows: %s", (command) => {
    expect(verdict(command).kind).toBe("allow");
  });

  it.each(ASK)("asks: %s", (command) => {
    expect(verdict(command).kind).toBe("ask");
  });

  it.each(BLOCK)("blocks: %s", (command) => {
    expect(verdict(command).kind).toBe("block");
  });

  it("a block beats an ask in the same command", () => {
    expect(verdict("gh pr merge 1 && git push origin main").kind).toBe("block");
  });

  it("gives a short reason that names the command", () => {
    const merge = verdict("gh pr merge 40 --merge");
    expect(merge.reason).toMatch(/gh pr merge/);
    const del = verdict("gh repo delete o/r --yes");
    expect(del.reason).toMatch(/gh repo delete/);
    const api = verdict("gh api -X DELETE repos/o/r");
    expect(api.reason).toMatch(/gh api/);
    for (const v of [merge, del, api]) {
      expect(typeof v.reason).toBe("string");
      expect(v.reason!.length).toBeGreaterThan(0);
      expect(v.reason!.length).toBeLessThan(120);
    }
  });

  it("allows when the payload cannot be read, so Claude is never locked out of Bash", () => {
    expect(run("not json").kind).toBe("allow");
  });
});
