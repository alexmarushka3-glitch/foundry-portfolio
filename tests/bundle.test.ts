import { execSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { appFileName, appFiles, appTitle, bundleApp } from "@/lib/bundle";
import { summarizeBrowserOutput, summarizeTestOutput } from "@/lib/pipeline/sandbox";
import { INTERFACE_FILES, LOGIC_FILES, STARTER_FILES } from "@/lib/starter";

describe("bundleApp", () => {
  it("writes the stylesheet and both scripts into one file, in order, and marks who built it", () => {
    const html = bundleApp({
      "app.js": "function add(a, b) { return a + b; }",
      "ui.js": "document.title = String(add(1, 2));",
      "style.css": "h1 { color: red; }",
    });
    expect(html).not.toMatch(/<link\b|<script\s+src=/i);
    expect(html).toContain("<style>\nh1 { color: red; }\n</style>");
    expect(html.indexOf("function add")).toBeLessThan(html.indexOf("document.title"));
    expect(html.startsWith("<!doctype html>\n<!-- Built by Foundry's AI agents")).toBe(true);
  });

  it("cannot be broken out of by a closing tag inside the code", () => {
    const html = bundleApp({
      "app.js": 'const s = "</script><img src=x onerror=alert(1)>";',
      "style.css": "/* </style><script>bad()</script> */",
    });
    expect(html).toContain('"<\\/script><img src=x onerror=alert(1)>"');
    expect(html).toContain("/* <\\/style><script>bad()</script> */");
    expect(html.match(/<\/style>/gi)).toHaveLength(1); // only the real closing tag
  });

  it("leaves outside references alone instead of fetching them", () => {
    const html = bundleApp({
      "index.html":
        '<!doctype html><html><head><link rel="stylesheet" href="https://x.test/a.css"></head><body><h1>A</h1><script src="https://x.test/a.js"></script></body></html>',
    });
    expect(html).toContain('href="https://x.test/a.css"');
    expect(html).toContain('src="https://x.test/a.js"');
  });

  it("names the saved file after the app", () => {
    expect(appTitle(bundleApp({}))).toBe("My app");
    expect(appFileName("<title>Tip Splitter!</title>")).toBe("tip-splitter.html");
    expect(appFileName("<h1>  </h1>")).toBe("my-app.html");
  });
});

describe("the starter kit", () => {
  it("lets each engineer write only their own files, and nobody the fixed ones", () => {
    for (const p of ["app.js", "tests/app.test.js", "tests/more.test.js"])
      expect(LOGIC_FILES.test(p)).toBe(true);
    for (const p of ["index.html", "style.css", "ui.js"])
      expect(INTERFACE_FILES.test(p)).toBe(true);
    for (const p of ["README.md", "package.json", "tests/../app.js", "src/app.js"]) {
      expect(LOGIC_FILES.test(p) || INTERFACE_FILES.test(p)).toBe(false);
    }
  });

  it("passes its own unit tests with npm test, as the sandbox runs them", () => {
    const dir = mkdtempSync(join(tmpdir(), "foundry-kit-"));
    try {
      for (const [p, c] of Object.entries(appFiles({}))) {
        mkdirSync(dirname(join(dir, p)), { recursive: true });
        writeFileSync(join(dir, p), c);
      }
      // Through the shell, so it also finds npm.cmd on Windows.
      const out = execSync("npm test", {
        cwd: dir,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      expect(summarizeTestOutput(out, 0)).toBe("npm test: 1 passed, 0 failed");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("keeps the export line app.js needs for the tests", () => {
    expect(STARTER_FILES["app.js"].trim().split("\n").at(-1)).toMatch(
      /module\.exports = \{ loadData, saveData \}/,
    );
  });
});

describe("test summaries", () => {
  it("reads node --test counts from both its spec and TAP output", () => {
    expect(summarizeTestOutput("ℹ pass 3\nℹ fail 1", 1)).toBe("npm test: 3 passed, 1 failed");
    expect(summarizeTestOutput("# pass 4\n# fail 0", 0)).toBe("npm test: 4 passed, 0 failed");
    expect(summarizeTestOutput("nothing", 1)).toBe("npm test failed");
  });

  it("reads the browser test counts", () => {
    expect(summarizeBrowserOutput("  2 passed (2.4s)", 0)).toMatch(/2 passed, 0 failed/);
  });
});
