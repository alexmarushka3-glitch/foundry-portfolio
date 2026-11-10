import { describe, expect, it } from "vitest";
import { AGENT_TOOLS, runTool } from "@/lib/pipeline/tools";
import { MAX_FILE_BYTES, MAX_WRITES, createWorkspace } from "@/lib/pipeline/workspace";

describe("workspace", () => {
  it("lists, reads and searches the starter kit", () => {
    const ws = createWorkspace();
    expect(ws.listDir(".")).toEqual(
      expect.arrayContaining([
        "README.md",
        "index.html",
        "app.js",
        "ui.js",
        "style.css",
        "tests/",
        "package.json",
      ]),
    );
    expect(ws.listDir("tests")).toEqual(["app.test.js"]);
    expect(ws.read("app.js")).toContain("function saveData");
    expect(ws.read("./app.js")).toBe(ws.read("app.js"));
    expect(ws.grep("STORAGE_KEY").some((l) => l.startsWith("app.js:"))).toBe(true);
    expect(ws.source).toEqual({ repo: "foundry starter kit", commit: "v1" });
  });

  it("refuses paths that escape the app and files that do not exist", () => {
    const ws = createWorkspace();
    for (const p of [
      "../package.json",
      "tests/../../.env.local",
      "/etc/passwd",
      "tests//app.test.js",
      "",
    ])
      expect(ws.read(p)).toBeNull();
    expect(ws.read("nope.txt")).toBeNull();
  });

  it("keeps writes in an overlay and leaves the bundled files alone", () => {
    const a = createWorkspace();
    a.write("tests/new.test.js", "const x = 1;\n");
    expect(a.read("tests/new.test.js")).toContain("x = 1");
    expect(a.changes()).toEqual({ "tests/new.test.js": "const x = 1;\n" });
    // a second workspace (the next run) starts clean
    expect(createWorkspace().read("tests/new.test.js")).toBeNull();
  });

  it("only allows writes to the app's own files and tests, within size and count limits", () => {
    const ws = createWorkspace();
    for (const p of [
      "package.json",
      ".github/workflows/x.yml",
      "tests/../package.json",
      "node_modules/x.js",
      "app.sh",
      "README.md",
      "../x.js",
      "src/app.js",
      "other.js",
    ]) {
      expect(() => ws.write(p, "x")).toThrow(/Not allowed/);
    }
    expect(() => ws.write("app.js", "x".repeat(MAX_FILE_BYTES + 1))).toThrow(/too large/);
    for (let i = 0; i < MAX_WRITES; i++) ws.write(`tests/f${i}.test.js`, "x");
    expect(() => ws.write("tests/one-more.test.js", "x")).toThrow(/Too many/);
    ws.write("tests/f0.test.js", "y"); // rewriting a file already written is fine
  });
});

describe("runTool", () => {
  it("gives the researcher read tools and no write tool", () => {
    const names = AGENT_TOOLS.researcher!.map((t) => t.name);
    expect(names).toEqual(["list_dir", "read_file", "grep"]);
    const ws = createWorkspace();
    const r = runTool(ws, "researcher", "write_file", { path: "app.js", content: "x" });
    expect(r.ok).toBe(false);
    expect(ws.changes()).toEqual({});
  });

  it("gives no tools to the planning and checking agents", () => {
    for (const a of ["story", "pm", "validator", "release"] as const)
      expect(AGENT_TOOLS[a]).toBeUndefined();
    // the verifier can read the files and run a browser test, but never write
    expect(AGENT_TOOLS.e2e!.map((t) => t.name)).toEqual(["read_file", "grep", "run_browser_test"]);
    expect(
      runTool(createWorkspace(), "e2e", "write_file", { path: "app.js", content: "x" }).ok,
    ).toBe(false);
    expect(runTool(createWorkspace(), "validator", "read_file", { path: "app.js" }).ok).toBe(false);
  });

  it("keeps each engineer to their own files", () => {
    const ws = createWorkspace();
    expect(runTool(ws, "backend", "write_file", { path: "app.js", content: "// b" }).ok).toBe(true);
    expect(
      runTool(ws, "backend", "write_file", { path: "tests/app.test.js", content: "// b" }).ok,
    ).toBe(true);
    expect(runTool(ws, "backend", "write_file", { path: "ui.js", content: "// b" }).ok).toBe(false);
    for (const p of ["index.html", "style.css", "ui.js"])
      expect(runTool(ws, "frontend", "write_file", { path: p, content: "// f" }).ok).toBe(true);
    expect(runTool(ws, "frontend", "write_file", { path: "app.js", content: "// f" }).ok).toBe(
      false,
    );
    expect(
      runTool(ws, "frontend", "write_file", { path: "tests/x.test.js", content: "// f" }).ok,
    ).toBe(false);
    expect(Object.keys(ws.changes()).sort()).toEqual([
      "app.js",
      "index.html",
      "style.css",
      "tests/app.test.js",
      "ui.js",
    ]);
  });

  it("turns bad calls into errors the agent can read, and never throws", () => {
    const ws = createWorkspace();
    expect(runTool(ws, "backend", "read_file", { path: "missing.js" })).toMatchObject({
      ok: false,
    });
    expect(
      runTool(ws, "backend", "write_file", { path: "package.json", content: "{}" }).text,
    ).toMatch(/Not allowed|may not write/);
    expect(runTool(ws, "backend", "rm", {})).toMatchObject({ ok: false });
    expect(runTool(ws, "backend", "read_file", null)).toMatchObject({ ok: false });
    expect(runTool(ws, "researcher", "grep", { pattern: "(" }).ok).toBe(true); // bad regex falls back to plain text
  });

  it("trims long file contents in results", () => {
    const ws = createWorkspace();
    ws.write("app.js", "a".repeat(7_000));
    expect(runTool(ws, "backend", "read_file", { path: "app.js" }).text.length).toBeLessThanOrEqual(
      6_000,
    );
  });
});
