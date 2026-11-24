import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Logo, { LOGO_COLORS } from "@/components/Logo";

/** The drawn shapes of an svg, in order, with the attributes that decide how it looks. */
function shapes(svg: string) {
  const out: string[] = [];
  for (const m of svg.matchAll(/<(rect|polygon|path)\b([^>]*)>/g)) {
    const attrs = [...m[2].matchAll(/([a-zA-Z-]+)="([^"]*)"/g)]
      .map(([, k, v]) => [k.toLowerCase(), v] as const)
      .filter(([k]) =>
        [
          "x",
          "y",
          "width",
          "height",
          "rx",
          "points",
          "d",
          "fill",
          "stroke",
          "stroke-width",
        ].includes(k),
      )
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`);
    out.push(`${m[1]} ${attrs.join(" ")}`);
  }
  return out;
}

describe("the Foundry logo", () => {
  const iconSvg = readFileSync(join(process.cwd(), "app", "icon.svg"), "utf8");
  const markup = renderToStaticMarkup(<Logo />);

  it("draws the tab icon (app/icon.svg) exactly like the in-page mark", () => {
    const fromComponent = shapes(markup);
    expect(shapes(iconSvg)).toEqual(fromComponent);
    expect(fromComponent.length).toBe(6);
  });

  it("is two halves of one regular octagon, joined on the diagonal", () => {
    const polys = [...markup.matchAll(/<polygon points="([^"]+)"/g)].map((m) =>
      m[1].split(" ").map((p) => p.split(",").map(Number)),
    );
    expect(polys).toHaveLength(2);
    const [upper, lower] = polys;
    // every corner sits on the same circle round (16, 16), except the two split points on the seam
    const onSeam = ([x, y]: number[]) => Math.abs(x + y - 32) < 0.02;
    for (const [x, y] of [...upper, ...lower].filter((p) => !onSeam(p))) {
      const r = Math.hypot(x - 16, y - 16);
      expect(Math.abs(r - 13.2)).toBeLessThan(0.05);
    }
    // the halves meet in exactly two shared points, both on the seam
    const shared = upper.filter((p) => lower.some((q) => q[0] === p[0] && q[1] === p[1]));
    expect(shared).toHaveLength(2);
    shared.forEach((p) => expect(onSeam(p)).toBe(true));
  });

  it("is hidden from screen readers and uses only the site's own greys", () => {
    expect(markup).toContain('aria-hidden="true"');
    const colours = new Set(markup.match(/#[0-9a-f]{6}/gi)?.map((c) => c.toLowerCase()));
    expect(colours).toEqual(
      new Set([LOGO_COLORS.iron, LOGO_COLORS.paper, LOGO_COLORS.mist].map((c) => c.toLowerCase())),
    );
  });
});
