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
});
