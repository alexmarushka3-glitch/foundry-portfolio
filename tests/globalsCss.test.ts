import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "app", "globals.css"), "utf8");
/** The CSS without comments, so words and braces in comments can't change what the tests match. */
const code = css.replace(/\/\*[\s\S]*?\*\//g, "");

/** The text of the first `@layer base { ... }` block, found by counting braces. */
function baseLayer() {
  const start = code.indexOf("@layer base {");
  expect(start, "an @layer base block").toBeGreaterThan(-1);
  let depth = 0;
  for (let k = code.indexOf("{", start); k < code.length; k++) {
    if (code[k] === "{") depth++;
    if (code[k] === "}" && --depth === 0) return code.slice(start, k + 1);
  }
  throw new Error("unclosed @layer base block");
}

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
    expect(baseLayer()).toMatch(/\sa \{\s*text-decoration: underline;/);
    expect(code).not.toMatch(/^a \{[^}]*text-decoration/m); // never as an unlayered rule
  });

  it("puts back the slider margin and a readable placeholder colour that the reset removes", () => {
    const base = baseLayer();
    expect(base).toMatch(/input\[type="range"\] \{\s*margin: 2px;/);
    const placeholder = base.match(/::placeholder \{([^}]*)\}/)?.[1] ?? "";
    expect(placeholder).toMatch(/color: var\(--muted\);/);
    expect(placeholder, "no extra transparency: it lowers the contrast").not.toMatch(/opacity/);
  });

  it("keeps the scope chevron's size, the 404 heading size, and the lesson numbers out of the reader", () => {
    expect(code).toMatch(/\.reality-col summary::after \{[^}]*box-sizing: content-box;/);
    const h1 = code.match(/\.section > h1 \{([^}]*)\}/)?.[1] ?? "";
    expect(h1).toMatch(/font-size: 2em;/);
    expect(h1, "the h1 never had a margin: the site resets it to 0").not.toMatch(/margin/);
    // the 404 page's logo sat inline on the text baseline; the reset makes svg a block, which took 7px out of the gap
    expect(code).toMatch(/\.section > svg \{[^}]*display: inline;[^}]*vertical-align: baseline;/);
    // a second declaration with empty alt text; browsers that don't know it keep the first
    expect(code).toMatch(
      /\.lessons li::before \{\s*content: counter\(lesson, decimal-leading-zero\);\s*content: counter\(lesson, decimal-leading-zero\) \/ "";/,
    );
  });

  it("keeps the scope cards' colour accent in forced-colors mode and the tap flash on the lines", () => {
    expect(code).toMatch(
      /@media \(forced-colors: active\) \{\s*\.reality-col \{[^}]*border-top: 3px solid CanvasText;/,
    );
    expect(code).toMatch(
      /summary,\s*\[role="button"\],\s*input\[type="range"\] \{[^}]*-webkit-tap-highlight-color/,
    );
  });

  it("is described correctly in docs/ARCHITECTURE.md (the reset layer is on)", () => {
    const doc = readFileSync(join(process.cwd(), "docs", "ARCHITECTURE.md"), "utf8");
    expect(doc).not.toMatch(/no reset layer/i);
    expect(doc).toMatch(/preflight|reset/i);
  });

  it("sets its own list markers where the reset would remove the browser's", () => {
    expect(css).toMatch(/\.app-next ol \{[^}]*list-style: decimal/);
    expect(css).toMatch(/\.eval-more ul \{[^}]*list-style: disc/);
  });

  it("animates the scope lines with CSS only, behind @supports and no-preference motion", () => {
    const gate = "@supports (interpolate-size: allow-keywords) and selector(::details-content) {";
    const start = code.indexOf(gate);
    expect(start, "an @supports block for interpolate-size and ::details-content").toBeGreaterThan(
      -1,
    );
    // find the end of that block by counting braces
    let depth = 0;
    let end = start;
    for (let k = code.indexOf("{", start); k < code.length; k++) {
      if (code[k] === "{") depth++;
      if (code[k] === "}" && --depth === 0) {
        end = k;
        break;
      }
    }
    const block = code.slice(start, end + 1);
    expect(block).toMatch(/@media \(prefers-reduced-motion: no-preference\) \{/);
    expect(block).toMatch(/\.reality-col details \{[^}]*interpolate-size: allow-keywords;/);
    const closed = block.match(/\.reality-col details::details-content \{([^}]*)\}/)?.[1] ?? "";
    expect(closed).toMatch(/height: 0;/);
    expect(closed).toMatch(/overflow: clip;/);
    // its own formatting context, so the paragraph's margin can't leak out and make the box jump
    expect(closed).toMatch(/display: flow-root;/);
    expect(closed).toMatch(/transition:[^;]*height[^;]*;/);
    expect(closed).toMatch(/content-visibility[^;]*allow-discrete/);
    expect(block).toMatch(/details\[open\]::details-content \{[^}]*height: auto;/);
    // nothing outside that block touches the pseudo-element, so old browsers and reduced motion just open instantly
    const outside = code.slice(0, start) + code.slice(end + 1);
    expect(outside).not.toContain("::details-content");
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

  it("caps the tall drawing at 360px in a laptop-size window, and at 420px on phones and tablets", () => {
    const src = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const media = src.match(/@media[^{]*\{(?:[^{}]|\{[^{}]*\})*\}/g) ?? [];
    const outside = media.reduce((rest, m) => rest.replace(m, ""), src);
    // everywhere else (901px to 1200px): shorter and less blown up
    expect(outside).toMatch(/\.pipeline-narrow \{[^}]*max-width: 360px;/);
    // up to 900px (one column) the cap stays at 420px, named explicitly so the order of the rules can't decide it
    const capped = media.filter(
      (m) =>
        m.startsWith("@media (max-width: 900px)") &&
        /\.pipeline-narrow[^{]*\{[^}]*max-width: 420px;/.test(m),
    );
    expect(capped, "a 900px block that caps .pipeline-narrow at 420px").toHaveLength(1);
  });
});
