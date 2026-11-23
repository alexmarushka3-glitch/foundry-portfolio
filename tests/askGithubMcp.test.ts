// Feeds sample GitHub MCP tool calls to the PreToolUse hook (.claude/hooks/ask-github-mcp.mjs)
// and checks the verdict, and checks that .claude/settings.json wires the hook to the right tools.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const HOOK = fileURLToPath(new URL("../.claude/hooks/ask-github-mcp.mjs", import.meta.url));
const SETTINGS = fileURLToPath(new URL("../.claude/settings.json", import.meta.url));

type Verdict = { kind: "allow" | "ask"; reason?: string };

function run(stdin: string): Verdict {
  const r = spawnSync(process.execPath, [HOOK], { input: stdin, encoding: "utf8", cwd: ROOT });
  expect(r.status).toBe(0);
  const out = r.stdout.trim();
  if (!out) return { kind: "allow" };
  const hso = JSON.parse(out).hookSpecificOutput;
  expect(hso.hookEventName).toBe("PreToolUse");
  return { kind: hso.permissionDecision, reason: hso.permissionDecisionReason };
}

const call = (tool_name: string, tool_input: unknown = {}): Verdict =>
  run(JSON.stringify({ tool_name, tool_input, cwd: ROOT }));

describe("ask-github-mcp hook", () => {
  it.each([
    "mcp__github__merge_pull_request",
    "mcp__github__delete_file",
    "mcp__github__delete_repository",
    "mcp__github__delete_branch", // not a real tool today: proves delete_* is covered
    "mcp__github__push_files", // can write straight to main
    "mcp__github__create_or_update_file", // can write straight to main
  ])("asks: %s", (tool) => {
    expect(call(tool).kind).toBe("ask");
  });

  it.each([
    "mcp__github__get_file_contents",
    "mcp__github__create_pull_request",
    "mcp__github__list_branches",
    "mcp__github__pull_request_read",
    "mcp__github__merge_pull_requests_list",
    "mcp__github__push_files_dry_run",
    "mcp__github__create_or_update_files",
    "mcp__github__update_pull_request", // left out on purpose
    "mcp__github__issue_write", // left out on purpose
    "mcp__other__merge_pull_request",
    "mcp__other__push_files",
  ])("allows: %s", (tool) => {
    expect(call(tool).kind).toBe("allow");
  });

  it("allows a Bash payload with no tool_name and unreadable input", () => {
    expect(run(JSON.stringify({ tool_input: { command: "gh pr view 40" } })).kind).toBe("allow");
    expect(run("not json").kind).toBe("allow");
  });

  it("names the tool and the target in a short reason", () => {
    const v = call("mcp__github__merge_pull_request", { owner: "o", repo: "r", pullNumber: 40 });
    expect(v.kind).toBe("ask");
    expect(v.reason).toMatch(/mcp__github__merge_pull_request/);
    expect(v.reason).toMatch(/o\/r#40/);
    expect(v.reason!.length).toBeLessThan(120);
  });

  it("says a file write goes straight to a branch, and names the branch", () => {
    for (const tool of ["mcp__github__push_files", "mcp__github__create_or_update_file"]) {
      const v = call(tool, { owner: "o", repo: "r", branch: "main", path: "a.md" });
      expect(v.kind).toBe("ask");
      expect(v.reason).toMatch(new RegExp(tool));
      expect(v.reason).toMatch(/writes files/);
      expect(v.reason).toMatch(/o\/r@main/);
      expect(v.reason!.length).toBeLessThan(120);
    }
  });

  it("still asks, with a short reason, when the input is missing or odd", () => {
    const odd = [
      undefined,
      null,
      "text",
      { owner: "x".repeat(500), repo: "r\u0000\n\u001b[31m", pullNumber: {} },
      { owner: ["a"], repo: 5 },
    ];
    for (const input of odd) {
      const v = call("mcp__github__delete_file", input);
      expect(v.kind).toBe("ask");
      expect(v.reason).toMatch(/mcp__github__delete_file/);
      expect(v.reason!.length).toBeLessThan(120);
      expect(v.reason).not.toMatch(/[\u0000-\u001f]/);
    }
  });
});

describe(".claude/settings.json wiring", () => {
  const settings = JSON.parse(readFileSync(SETTINGS, "utf8"));
  const entries: { matcher?: string; hooks: { command: string }[] }[] = settings.hooks.PreToolUse;
  const mcpEntry = entries.find((e) =>
    e.hooks.some((h) => h.command.includes("ask-github-mcp.mjs")),
  );

  it("has a PreToolUse entry that runs the hook", () => {
    expect(mcpEntry).toBeDefined();
    expect(existsSync(HOOK)).toBe(true);
  });

  it("matches the merge, delete and direct-write tools and nothing else", () => {
    const matcher = new RegExp(`^(?:${mcpEntry!.matcher})$`);
    for (const t of [
      "mcp__github__merge_pull_request",
      "mcp__github__delete_file",
      "mcp__github__delete_repository",
      "mcp__github__delete_anything",
      "mcp__github__push_files",
      "mcp__github__create_or_update_file",
    ]) {
      expect(matcher.test(t), t).toBe(true);
    }
    for (const t of [
      "mcp__github__get_me",
      "mcp__github__create_pull_request",
      "mcp__github__merge_pull_requests_list",
      "mcp__github__push_files_dry_run",
      "mcp__github__update_pull_request",
      "mcp__github__issue_write",
      "mcp__other__delete_file",
      "Bash",
    ]) {
      expect(matcher.test(t), t).toBe(false);
    }
  });

  it("keeps the existing Bash guardrail entry", () => {
    const bash = entries.find((e) => e.matcher === "Bash");
    expect(bash?.hooks[0].command).toContain("block-dangerous-git.mjs");
  });
});
