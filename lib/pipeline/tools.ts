import { INTERFACE_FILES, LOGIC_FILES } from "../starter";
import type { AgentName } from "../types";
import type { Workspace } from "./workspace";

// The tools the agents can call. Each one works on the Workspace only: no shell, no network, no
// access to the portfolio's own files. Which agent gets which tool is decided here and nowhere else.

export type ToolDef = {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, { type: string; description: string }>;
    required: string[];
  };
};

const LIST_DIR: ToolDef = {
  name: "list_dir",
  description: "List the files and folders in a directory of the app. Use '.' for the top level.",
  input_schema: {
    type: "object",
    properties: { path: { type: "string", description: "Directory path, for example 'tests'." } },
    required: ["path"],
  },
};
const READ_FILE: ToolDef = {
  name: "read_file",
  description: "Read one file of the app, including changes already written in this run.",
  input_schema: {
    type: "object",
    properties: { path: { type: "string", description: "File path, for example 'app.js'." } },
    required: ["path"],
  },
};
const GREP: ToolDef = {
  name: "grep",
  description:
    "Search every file for a regular expression (case-insensitive). Returns up to 40 matching lines.",
  input_schema: {
    type: "object",
    properties: { pattern: { type: "string", description: "Text or regular expression." } },
    required: ["pattern"],
  },
};
const WRITE_FILE: ToolDef = {
  name: "write_file",
  description:
    "Create or replace one whole file. You may write only your own files (named in your instructions). Send the complete new file content.",
  input_schema: {
    type: "object",
    properties: {
      path: { type: "string", description: "File path, for example 'app.js'." },
      content: { type: "string", description: "The complete file content." },
    },
    required: ["path", "content"],
  },
};

/** Runs the sample app's real tests on the files written so far. Only offered when a sandbox is available. */
export const RUN_TESTS_TOOL: ToolDef = {
  name: "run_tests",
  description:
    "Run the app's real unit tests (npm test: node --test tests/) in an isolated sandbox on the files written so far, and read the result. Use it after writing files; fix what fails. Limited to two calls.",
  input_schema: { type: "object", properties: {}, required: [] },
};

/** The Browser Tester's way into a real browser: it submits a Playwright test file and gets the real result back. */
export const RUN_BROWSER_TEST_TOOL: ToolDef = {
  name: "run_browser_test",
  description:
    "Run a Playwright test file in a real headless Chromium against the finished app: the app's files are put together into the one .html file people will use, and served at '/' in an isolated sandbox. A smoke test (the page loads with an h1 and no errors) runs too. Send the complete test file as `spec` (an ES module: import { test, expect } from '@playwright/test'; use page.goto('/')). Each test starts with empty storage. Returns the real pass or fail result and picture(s) of the page. Limited to three calls.",
  input_schema: {
    type: "object",
    properties: { spec: { type: "string", description: "The complete Playwright test file." } },
    required: ["spec"],
  },
};

export const AGENT_TOOLS: Partial<Record<AgentName, ToolDef[]>> = {
  researcher: [LIST_DIR, READ_FILE, GREP],
  backend: [READ_FILE, GREP, WRITE_FILE, RUN_TESTS_TOOL],
  frontend: [READ_FILE, GREP, WRITE_FILE],
  e2e: [READ_FILE, GREP, RUN_BROWSER_TEST_TOOL],
};

/** The tools an agent is actually offered: run_tests only when a sandbox can run it. */
export function toolsFor(
  agent: AgentName,
  canRunTests: boolean,
  canRunBrowser = false,
): ToolDef[] | undefined {
  const all = AGENT_TOOLS[agent];
  return all?.filter((t) =>
    t.name === RUN_TESTS_TOOL.name
      ? canRunTests
      : t.name === RUN_BROWSER_TEST_TOOL.name
        ? canRunBrowser
        : true,
  );
}

/** How many times one agent may run the tests in one round. */
export const MAX_TEST_RUNS = 2;

/** How many times the Browser Tester may run its browser test in one round. */
export const MAX_BROWSER_RUNS = 3;

/** Turns on the writes each engineer is meant to make, so the backend cannot rewrite the page and the reverse. */
const OWN_PATHS: Partial<Record<AgentName, RegExp>> = {
  backend: LOGIC_FILES,
  frontend: INTERFACE_FILES,
};

export const MAX_TOOL_RESULT = 6_000;

export type ToolOutcome = {
  ok: boolean;
  text: string;
  /** One short line for the page. */ label: string;
};

const short = (s: string, n = 60) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Run one tool call. Never throws: a bad call comes back as an error the agent can read and fix. */
export function runTool(
  ws: Workspace,
  agent: AgentName,
  name: string,
  input: unknown,
): ToolOutcome {
  const args = (input ?? {}) as Record<string, unknown>;
  const str = (k: string) => (typeof args[k] === "string" ? (args[k] as string) : "");
  const allowed = AGENT_TOOLS[agent]?.some((t) => t.name === name);
  if (!allowed)
    return {
      ok: false,
      text: `Tool ${name} is not available to this agent.`,
      label: `${name} (not allowed)`,
    };

  try {
    switch (name) {
      case "list_dir": {
        const entries = ws.listDir(str("path") || ".");
        return {
          ok: true,
          text: entries.length ? entries.join("\n") : "(empty or not found)",
          label: `list_dir ${short(str("path") || ".")}`,
        };
      }
      case "read_file": {
        const body = ws.read(str("path"));
        if (body === null)
          return {
            ok: false,
            text: `No such file: ${str("path")}`,
            label: `read_file ${short(str("path"))} (not found)`,
          };
        return {
          ok: true,
          text: body.slice(0, MAX_TOOL_RESULT),
          label: `read_file ${short(str("path"))}`,
        };
      }
      case "grep": {
        const hits = ws.grep(str("pattern"));
        return {
          ok: true,
          text: hits.length ? hits.join("\n") : "(no matches)",
          label: `grep ${short(str("pattern"))}`,
        };
      }
      case "write_file": {
        const path = str("path");
        const own = OWN_PATHS[agent];
        if (own && !own.test(path.replace(/\\/g, "/").replace(/^\.?\/+/, ""))) {
          return {
            ok: false,
            text: `The ${agent} agent may not write ${path}.`,
            label: `write_file ${short(path)} (not allowed)`,
          };
        }
        ws.write(path, str("content"));
        return {
          ok: true,
          text: `Wrote ${path} (${str("content").length} characters).`,
          label: `write_file ${short(path)}`,
        };
      }
    }
  } catch (err) {
    return { ok: false, text: (err as Error).message, label: `${name} failed` };
  }
  return { ok: false, text: `Unknown tool ${name}.`, label: `${name} (unknown)` };
}
