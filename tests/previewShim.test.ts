import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { STORAGE_SHIM_CODE, withHostedShim } from "@/lib/previewShim";

const squash = (s: string) => s.replace(/\s+/g, "");

describe("previewShim", () => {
  it("is the same storage stand-in that public/preview/runner.js carries", () => {
    const runner = readFileSync("public/preview/runner.js", "utf8");
    expect(squash(runner)).toContain(squash(STORAGE_SHIM_CODE));
  });

  it("goes right after <head>, before the app's own scripts", () => {
    const out = withHostedShim(
      "<!doctype html><html><head><title>T</title></head><body></body></html>",
    );
    expect(out.indexOf("<script>")).toBeGreaterThan(out.indexOf("<head>"));
    expect(out.indexOf("<script>")).toBeLessThan(out.indexOf("<title>"));
    expect(out).toContain("localStorage");
  });

  it("goes first when the page has no <head>", () => {
    expect(withHostedShim("<h1>Hi</h1>").startsWith("<script>")).toBe(true);
  });

  it("does not report errors to a parent window (a hosted page has none)", () => {
    expect(withHostedShim("<head></head>")).not.toContain("postMessage");
  });
});
