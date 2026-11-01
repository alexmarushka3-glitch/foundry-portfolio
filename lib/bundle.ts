// Puts a finished app's files (index.html, style.css, app.js, ui.js) into one self-contained .html file: the file the
// visitor uses on the page, saves, and that the real browser test runs against. Browser and server safe.

import { STARTER_FILES } from "./starter";

/** Escape a script body so nothing in it can close the inline <script> tag early. */
const inlineScript = (code: string) => code.replace(/<\/(script)/gi, "<\\/$1");
const inlineStyle = (css: string) => css.replace(/<\/(style)/gi, "<\\/$1");

/** The app's files: the starter kit with the run's changes on top. */
export function appFiles(changes: Record<string, string>): Record<string, string> {
  return { ...STARTER_FILES, ...changes };
}

/**
 * One .html file with the stylesheet and scripts written in. Local references to the app's own files are inlined;
 * anything else is left as it is (the rules forbid outside resources, and the preview blocks them).
 */
export function bundleApp(changes: Record<string, string>): string {
  const files = appFiles(changes);
  const local = (ref: string) => files[ref.replace(/^\.?\//, "")];
  let html = files["index.html"] ?? STARTER_FILES["index.html"];

  html = html.replace(/<link\b[^>]*\bhref=["']([^"']+)["'][^>]*>/gi, (tag, href: string) => {
    if (!/\brel=["']?stylesheet/i.test(tag)) return tag;
    const css = local(href);
    return css === undefined ? tag : `<style>\n${inlineStyle(css)}\n</style>`;
  });
  html = html.replace(/<script\b([^>]*)\bsrc=["']([^"']+)["']([^>]*)>\s*<\/script>/gi, (tag, before: string, src: string, after: string) => {
    const js = local(src);
    if (js === undefined) return tag;
    const attrs = `${before} ${after}`.replace(/\s+/g, " ").trim();
    return `<script${attrs ? ` ${attrs}` : ""}>\n${inlineScript(js)}\n</script>`;
  });
  const mark = "<!-- Built by Foundry's AI agents: https://alexmarushka.vercel.app -->\n";
  return html.startsWith("<!doctype") || html.startsWith("<!DOCTYPE") ? html.replace(/^(<!doctype[^>]*>\n?)/i, `$1${mark}`) : mark + html;
}

/** The app's title from its <title> or first <h1>, for the saved file's name. */
export function appTitle(html: string): string {
  const raw = /<title>([^<]*)<\/title>/i.exec(html)?.[1] || /<h1[^>]*>([^<]*)<\/h1>/i.exec(html)?.[1] || "My app";
  return raw.replace(/\s+/g, " ").trim() || "My app";
}

/** A safe file name, for example "tip-calculator.html". */
export function appFileName(html: string): string {
  const slug = appTitle(html)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${slug || "my-app"}.html`;
}
