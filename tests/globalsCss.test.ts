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

  it("leaves out Tailwind's reset layer until the redesign adopts it", () => {
    expect(css).not.toContain("tailwindcss/preflight");
    expect(css).toContain("source(none)");
  });

  it("keeps the title bar's idea on one line, however it is typed", () => {
    // .crumb keeps the spaces around its separator with white-space: pre, which the idea would inherit
    expect(css).toMatch(/\.crumb-idea \{[^}]*white-space: nowrap;/);
  });

  it("gives the wide drawing room beside the sidebar: a narrow sidebar and trimmed padding", () => {
    // page width (--wrap) - page gutters - frame border 2 - sidebar - its divider 1 - stage padding = the drawing's width.
    // The drawing is 1000 units wide with 12-unit text, so 11px text needs at least 917px.
    // (The e2e width sweep measures the real thing; this keeps the arithmetic honest when a number changes.)
    const src = css.replace(/\/\*[\s\S]*?\*\//g, ""); // comments out
    const wrap = Number(src.match(/--wrap:\s*(\d+)px;/)?.[1]);
    const gutter = Number(src.match(/main,\s*\.footer \{[^}]*padding: 0 (\d+)px;/)?.[1]);
    const sidebar = Number(src.match(/\.stage-body \{[^}]*grid-template-columns: (\d+)px /)?.[1]);
    const padding = Number(src.match(/\.stage-main \{[^}]*padding: (\d+)px;/)?.[1]);
    for (const [name, n] of Object.entries({ wrap, gutter, sidebar, padding })) {
      expect(n, name).toBeGreaterThan(0);
    }
    const drawing = wrap - 2 * gutter - 2 - sidebar - 1 - 2 * padding;
    expect(drawing, "the wide drawing's width at full size").toBeGreaterThanOrEqual(917);
  });

  it("switches to the tall drawing exactly where the wide one stops fitting (the page width)", () => {
    const src = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const wrap = Number(src.match(/--wrap:\s*(\d+)px;/)?.[1]);
    const stage = readFileSync(join(process.cwd(), "components", "Stage.tsx"), "utf8");
    expect(stage).toContain(`useMediaQuery("(max-width: ${wrap}px)")`);
  });

  it("keeps the sticky sidebar inside short windows, scrolling instead of cutting off the last agents", () => {
    const src = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const rule = src.match(/\.agent-list \{([^}]*)\}/)?.[1] ?? "";
    expect(rule).toMatch(/max-height: calc\(100vh - var\(--nav-h\) - 40px\);/);
    expect(rule).toMatch(/overflow-y: auto;/);
  });

  it("caps the tall drawing's width outside the phone query too, so it isn't blown up on a laptop", () => {
    // the 900px query already caps it for phones and tablets; between 901px and 1200px the same cap must hold
    const src = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const outside = src.replace(/@media[^{]*\{(?:[^{}]|\{[^{}]*\})*\}/g, "");
    expect(outside).toMatch(/\.pipeline-narrow \{[^}]*max-width: 420px;/);
  });
});
