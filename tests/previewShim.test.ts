import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { STORAGE_SHIM_CODE, hostedAppPage } from "@/lib/previewShim";
import { HOSTED_STORAGE_MAX } from "@/lib/share";

const squash = (s: string) => s.replace(/\s+/g, "");

describe("previewShim", () => {
  it("is the same storage stand-in that public/preview/frame.html carries", () => {
    const runner = readFileSync("public/preview/frame.html", "utf8");
    expect(squash(runner)).toContain(squash(STORAGE_SHIM_CODE));
  });
});

describe("hostedAppPage", () => {
  const APP =
    "<!doctype html><html><head><title>Tip &amp; split</title></head><body><h1>Hi</h1></body></html>";

  it("is a loader with the app inside as a string, titled after the app", () => {
    const page = hostedAppPage(APP);
    expect(page.startsWith("<!doctype html>")).toBe(true);
    // the title is decoded ("Tip & split"), then escaped again for the page
    expect(page).toContain("<title>Tip &#38; split</title>");
    expect(page.match(/<\/script>/g)).toHaveLength(1); // one real script element
    expect(page).not.toContain("<h1>Hi</h1>"); // only inside the string, escaped
    expect(page).toContain("\\u003ch1>Hi\\u003c/h1>");
  });

  it("cannot be broken out of by text in the app that closes a script or looks like a placeholder", () => {
    const sneaky =
      '<head></head><body><script>var x="</script><script>alert(1)</script>__TITLE__ __MAX__";</script></body>';
    const page = hostedAppPage(sneaky);
    expect(page.match(/<\/script>/g)).toHaveLength(1); // the loader's own end tag; its code builds the app's as <\/script>
    expect(page).toContain("__TITLE__ __MAX__"); // not replaced inside the app
    expect(page).toContain(String(HOSTED_STORAGE_MAX));
  });

  it("escapes the two line separators that end a line in old JavaScript parsers", () => {
    const page = hostedAppPage("<title>x</title>" + String.fromCharCode(0x2028, 0x2029));
    expect(page).not.toContain(String.fromCharCode(0x2028));
    expect(page).not.toContain(String.fromCharCode(0x2029));
  });

  it("asks its parent for the saved data, answers only to its parent, and has no network or external script", () => {
    const page = hostedAppPage(APP);
    expect(page).toContain("e.source !== parent");
    expect(page).toContain("hosted-storage");
    expect(page).not.toMatch(/<script\b[^>]*\bsrc\s*=/i);
    expect(page).not.toMatch(/fetch\(|XMLHttpRequest|WebSocket/);
  });
});

describe("preview frame", () => {
  it("has no external script (iPhone Safari refuses one inside the sandboxed frame, and the app never opens)", () => {
    const frame = readFileSync("public/preview/frame.html", "utf8");
    expect(frame).not.toMatch(/<script\b[^>]*\bsrc\s*=/i);
  });
});
