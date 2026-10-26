// Calls the real browser runner directly (no model, no cost) with a tiny spec, and checks the pictures come back.
//   npx.cmd tsx --env-file=.env.sandbox.local scripts/sandbox-browser-runner-check.mjs
import { createSandboxBrowserRunner } from "../lib/pipeline/sandbox.ts";

const spec = `import { test, expect } from "@playwright/test";
test("adds and shows a task", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("New task").fill("write the report");
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.getByRole("listitem")).toContainText("write the report");
});
test("this one fails on purpose", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("text that is not on the page")).toBeVisible({ timeout: 1000 });
});
`;
const run = createSandboxBrowserRunner();
const t0 = Date.now();
const r = await run({ "public/style.css": "body { background: #e8f0ff; }\n" }, spec);
console.log(`${((Date.now() - t0) / 1000).toFixed(1)}s`, JSON.stringify({ ran: r.ran, ok: r.ok, summary: r.summary, shots: r.shots.map((s) => [s.label, Math.round(s.png.length / 1024) + "KB"]) }));
console.log(r.output.split("\n").slice(-12).join("\n"));
