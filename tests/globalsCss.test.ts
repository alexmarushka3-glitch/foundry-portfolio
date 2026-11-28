import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "app", "globals.css"), "utf8");

/** Names shadcn writes when it adds a component (unprefixed). The site keeps them for its own colours or not at all. */
const SHADCN_UNPREFIXED = [
  "--background",
  "--foreground",
  "--card",
  "--card-foreground",
  "--popover",
  "--popover-foreground",
  "--primary",
  "--primary-foreground",
  "--secondary",
  "--secondary-foreground",
  "--muted-foreground",
  "--accent",
  "--accent-foreground",
  "--destructive",
  "--border",
  "--input",
  "--ring",
  "--radius",
];

describe("app/globals.css and shadcn", () => {
  it("has none of shadcn's unprefixed tokens (they must be renamed to --ui-*)", () => {
    for (const name of SHADCN_UNPREFIXED) {
      expect(css, `${name} is declared`).not.toMatch(new RegExp(`^\\s*${name}\\s*:`, "m"));
    }
  });

  it("keeps the site's own --muted text colour", () => {
    // shadcn writes --muted as a background colour; the site uses it for secondary text
    expect(css).toMatch(/^\s*--muted:\s*#4b555e;/m);
    expect(css).not.toMatch(/--muted:\s*oklch/);
  });

  it("imports Tailwind's reset in the base layer, so the site's own unlayered rules still win", () => {
    expect(css).toMatch(/@import "tailwindcss\/preflight\.css" layer\(base\);/);
    expect(css).toMatch(/@layer theme, base, components, utilities;/);
    expect(css).toContain("source(none)");
  });

  it("sets the base border colour that shadcn components expect, for every element", () => {
    expect(css).toMatch(
      /@layer base \{\s*\*,\s*::after,\s*::before \{\s*border-color: var\(--ui-border\);/,
    );
  });

  it("puts the link underline back in the base layer, so utilities can still remove it", () => {
    expect(css).toMatch(/@layer base \{[\s\S]*?\sa \{\s*text-decoration: underline;/);
    expect(css).not.toMatch(/^a \{[^}]*text-decoration/m);
  });

  it("sets its own list markers where the reset would remove the browser's", () => {
    expect(css).toMatch(/\.app-next ol \{[^}]*list-style: decimal/);
    expect(css).toMatch(/\.eval-more ul \{[^}]*list-style: disc/);
  });

  it("animates the scope lines with CSS only, behind @supports and no-preference motion", () => {
    const start = css.indexOf("@supports (interpolate-size: allow-keywords) {");
    expect(start, "an @supports block for interpolate-size").toBeGreaterThan(-1);
    // find the end of that block by counting braces
    let depth = 0;
    let end = start;
    for (let k = css.indexOf("{", start); k < css.length; k++) {
      if (css[k] === "{") depth++;
      if (css[k] === "}" && --depth === 0) {
        end = k;
        break;
      }
    }
    const block = css.slice(start, end + 1);
    expect(block).toMatch(/@media \(prefers-reduced-motion: no-preference\) \{/);
    expect(block).toMatch(/interpolate-size: allow-keywords/);
    expect(block).toMatch(/\.reality-col details::details-content \{[^}]*height: 0/);
    expect(block).toMatch(/transition:[^;]*height[^;]*;/);
    expect(block).toMatch(/content-visibility[^;]*allow-discrete/);
    expect(block).toMatch(/details\[open\]::details-content \{[^}]*height: auto/);
    // nothing outside that block touches ::details-content, so old browsers and reduced motion just open instantly
    const outside = css.slice(0, start) + css.slice(end + 1);
    expect(outside).not.toContain("::details-content");
  });
});
