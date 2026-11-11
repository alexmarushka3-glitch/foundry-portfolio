import { expect, test, type Page } from "@playwright/test";

// Baseline UI checks. Recorded examples only: no test types an idea, so no model is called and nothing costs money.

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text()}`);
  });
  return errors;
}

test("home page loads with the main sections and no browser errors", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/");
  await expect(page).toHaveTitle(/Foundry/);
  await expect(page.getByRole("heading", { level: 1, name: "Foundry" })).toBeVisible();
  for (const h of ["Build an app", "The project in short", "Scope and limits", "About"]) {
    await expect(page.getByRole("heading", { level: 2, name: h })).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test("a recorded example replays to the end and offers the app", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/");
  const examples = page.getByRole("group", { name: "Examples" }).getByRole("button");
  await expect(examples).toHaveCount(3);
  await examples.nth(1).click();
  await expect(examples.nth(1)).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Save the app").first()).toBeVisible({ timeout: 45_000 });
  // The page must say which mode ran (honesty rule), and a replay must never be passed off as a typed live run.
  await expect(page.getByText(/replay of a real live run/i).first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("the pipeline shows all eight agents", async ({ page }) => {
  await page.goto("/");
  for (const name of [
    "Researcher",
    "Story Writer",
    "Project Manager",
    "Logic",
    "Interface",
    "Browser Tester",
    "Validator",
    "Release",
  ]) {
    await expect(page.getByRole("button", { name: new RegExp(`^${name}:`) })).toBeVisible();
  }
});

test("dark mode toggle switches the theme and the choice survives a reload", async ({ page }) => {
  await page.goto("/");
  const toggle = page.getByRole("switch", { name: "Dark mode" });
  const before = await toggle.getAttribute("aria-checked");
  await toggle.click();
  const after = await toggle.getAttribute("aria-checked");
  expect(after).not.toBe(before);
  const theme = await page.locator("html").getAttribute("data-theme");
  expect(["light", "dark"]).toContain(theme);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme!);
});

test("the sample admin page says its numbers are made up and is not indexed", async ({ page }) => {
  await page.goto("/admin-demo");
  await expect(page.getByText(/sample|made.?up/i).first()).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

test("the private admin page is not open to visitors", async ({ page }) => {
  const res = await page.goto("/admin");
  // 404 when ADMIN_TOKEN is unset, or a login form when it is set. Never the dashboard itself.
  expect(res?.status()).toBeLessThan(500);
  await expect(page.getByText(/run log|recent runs/i)).toHaveCount(0);
});

test("an unknown page shows the 404 page", async ({ page }) => {
  const res = await page.goto("/no-such-page");
  expect(res?.status()).toBe(404);
});

test("the phone layout has no sideways scroll", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("GET /api/run says whether live runs are on, and a bad body is refused", async ({
  request,
}) => {
  const get = await request.get("/api/run");
  expect(get.ok()).toBe(true);
  expect(typeof (await get.json()).live).toBe("boolean");
  const bad = await request.post("/api/run", { data: { idea: "" } });
  expect(bad.status()).toBeGreaterThanOrEqual(400);
  expect(bad.status()).toBeLessThan(500);
});
