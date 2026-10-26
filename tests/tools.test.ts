import { describe, expect, it } from "vitest";
import { AGENT_TOOLS, runTool } from "@/lib/pipeline/tools";
import { MAX_FILE_BYTES, MAX_WRITES, createWorkspace } from "@/lib/pipeline/workspace";

describe("workspace", () => {
  it("lists, reads and searches the bundled sample app", () => {
    const ws = createWorkspace();
    expect(ws.listDir(".")).toEqual(expect.arrayContaining(["src/", "public/", "tests/", "package.json"]));
    expect(ws.listDir("src")).toEqual(expect.arrayContaining(["app.js", "db.js"]));
    expect(ws.read("src/db.js")).toContain("CREATE TABLE");
    expect(ws.read("./src/db.js")).toBe(ws.read("src/db.js"));
    expect(ws.grep("created_at").some((l) => l.startsWith("src/db.js:"))).toBe(true);
    expect(ws.source.commit).toMatch(/^[0-9a-f]{40}$/);
  });

  it("refuses paths that escape the app and files that do not exist", () => {
    const ws = createWorkspace();
    for (const p of ["../package.json", "src/../../.env.local", "/etc/passwd", "src//db.js", ""]) expect(ws.read(p)).toBeNull();
    expect(ws.read("nope.txt")).toBeNull();
  });

  it("keeps writes in an overlay and leaves the bundled files alone", () => {
    const a = createWorkspace();
    a.write("src/new.js", "export const x = 1;\n");
    expect(a.read("src/new.js")).toContain("x = 1");
    expect(a.changes()).toEqual({ "src/new.js": "export const x = 1;\n" });
    // a second workspace (the next run) starts clean
    expect(createWorkspace().read("src/new.js")).toBeNull();
  });

  it("only allows writes to source, page and test files, within size and count limits", () => {
    const ws = createWorkspace();
    for (const p of ["package.json", ".github/workflows/x.yml", "src/../package.json", "node_modules/x.js", "src/x.sh", "README.md", "../x.js"]) {
      expect(() => ws.write(p, "x")).toThrow(/Not allowed/);
    }
    expect(() => ws.write("src/big.js", "x".repeat(MAX_FILE_BYTES + 1))).toThrow(/too large/);
    for (let i = 0; i < MAX_WRITES; i++) ws.write(`src/f${i}.js`, "x");
    expect(() => ws.write("src/one-more.js", "x")).toThrow(/Too many/);
    ws.write("src/f0.js", "y"); // rewriting a file already written is fine
  });
});

describe("runTool", () => {
  it("gives the researcher read tools and no write tool", () => {
    const names = AGENT_TOOLS.researcher!.map((t) => t.name);
    expect(names).toEqual(["list_dir", "read_file", "grep"]);
    const ws = createWorkspace();
    const r = runTool(ws, "researcher", "write_file", { path: "src/x.js", content: "x" });
    expect(r.ok).toBe(false);
    expect(ws.changes()).toEqual({});
  });

  it("gives no tools to the planning and checking agents", () => {
    for (const a of ["story", "pm", "e2e", "validator", "release"] as const) expect(AGENT_TOOLS[a]).toBeUndefined();
    expect(runTool(createWorkspace(), "validator", "read_file", { path: "src/db.js" }).ok).toBe(false);
  });

  it("keeps each engineer to their own folders", () => {
    const ws = createWorkspace();
    expect(runTool(ws, "backend", "write_file", { path: "src/db.js", content: "// b" }).ok).toBe(true);
    expect(runTool(ws, "backend", "write_file", { path: "public/app.js", content: "// b" }).ok).toBe(false);
    expect(runTool(ws, "frontend", "write_file", { path: "public/app.js", content: "// f" }).ok).toBe(true);
    expect(runTool(ws, "frontend", "write_file", { path: "src/db.js", content: "// f" }).ok).toBe(false);
    expect(Object.keys(ws.changes()).sort()).toEqual(["public/app.js", "src/db.js"]);
  });

  it("turns bad calls into errors the agent can read, and never throws", () => {
    const ws = createWorkspace();
    expect(runTool(ws, "backend", "read_file", { path: "missing.js" })).toMatchObject({ ok: false });
    expect(runTool(ws, "backend", "write_file", { path: "package.json", content: "{}" }).text).toMatch(/Not allowed|may not write/);
    expect(runTool(ws, "backend", "rm", {})).toMatchObject({ ok: false });
    expect(runTool(ws, "backend", "read_file", null)).toMatchObject({ ok: false });
    expect(runTool(ws, "researcher", "grep", { pattern: "(" }).ok).toBe(true); // bad regex falls back to plain text
  });

  it("trims long file contents in results", () => {
    const ws = createWorkspace();
    ws.write("src/long.js", "a".repeat(7_000));
    expect(runTool(ws, "backend", "read_file", { path: "src/long.js" }).text.length).toBeLessThanOrEqual(6_000);
  });
});
