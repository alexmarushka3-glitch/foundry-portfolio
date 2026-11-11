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
  test.setTimeout(120_000); // a replay takes about 15 s; a cold dev server compiles first
  const errors = watchErrors(page);
  await page.goto("/");
  const examples = page.getByRole("group", { name: "Examples" }).getByRole("button");
  await expect(examples).toHaveCount(3);
  await examples.nth(1).click();
  await expect(examples.nth(1)).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Save the app").first()).toBeVisible({ timeout: 90_000 });
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

test.describe("dark mode", () => {
  // The toggle follows the system setting first, so pin it: the start state is then always light.
  test.use({ colorScheme: "light" });

  test("toggle switches the theme and the choice survives a reload", async ({ page }) => {
    await page.goto("/");
    const toggle = page.getByRole("switch", { name: "Dark mode" });
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    // A click made before the page finishes loading does nothing, so click again until it takes.
    await expect(async () => {
      if ((await toggle.getAttribute("aria-checked")) === "false") await toggle.click();
      await expect(toggle).toHaveAttribute("aria-checked", "true", { timeout: 1_000 });
    }).toPass({ timeout: 15_000 });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });
});

test("the sample admin page says its numbers are made up and is not indexed", async ({ page }) => {
  await page.goto("/admin-demo");
  await expect(page.getByText(/sample|made.?up/i).first()).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

test("the private admin page is not open to visitors", async ({ page }) => {
  const res = await page.goto("/admin");
  // 404 when ADMIN_TOKEN is unset, or a login form when it is set. Never the dashboard itself.
  if (res?.status() !== 404) {
    expect(res?.status()).toBe(200);
    await expect(page.locator('input[type="password"]')).toBeVisible();
  }
  await expect(page.getByRole("button", { name: /clear the run log/i })).toHaveCount(0);
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

test("Open full screen shows the finished app in its own sealed tab", async ({ page, context }) => {
  test.setTimeout(120_000);
  await page.goto("/");
  await page.getByRole("group", { name: "Examples" }).getByRole("button").nth(1).click();
  await expect(page.getByText("Save the app").first()).toBeVisible({ timeout: 90_000 });
  const [tab] = await Promise.all([
    context.waitForEvent("page"),
    page.getByRole("button", { name: "Open full screen" }).click(),
  ]);
  const app = tab.frameLocator("#app");
  await expect(app.locator("body")).not.toBeEmpty({ timeout: 15_000 });
  await expect(app.locator("h1, h2").first()).toBeVisible({ timeout: 15_000 });
  // The app is sealed: it cannot read the site's cookies or storage.
  const appFrame = tab
    .frames()
    .find((f) => f !== tab.mainFrame() && f.url().endsWith("/preview/frame.html"))!;
  const outcome = await appFrame.evaluate(() => {
    try {
      void document.cookie;
      return "could read cookies";
    } catch (e) {
      return (e as Error).name;
    }
  });
  expect(outcome).toBe("SecurityError");
});

test("the full-screen page is served with its own tight headers", async ({ request }) => {
  const res = await request.get("/preview/full.html");
  expect(res.ok()).toBe(true);
  const h = res.headers();
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["content-security-policy"]).not.toMatch(/script-src[^;]*unsafe-inline/);
  expect(h["cross-origin-opener-policy"]).toBe("same-origin");
  expect(h["x-frame-options"]).toBe("DENY");
});

test("Get a link shows the link and how long it lasts (server answers mocked, so nothing is stored)", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.route("**/api/share", async (route) => {
    if (route.request().method() === "POST") {
      const sent = route.request().postDataJSON() as { html: string };
      expect(sent.html).toContain("<!doctype html");
      await route.fulfill({
        json: { id: "x", url: "https://example.test/a/abc", expiresAt: "later" },
      });
    } else await route.fulfill({ json: { available: true } });
  });
  await page.goto("/");
  await page.getByRole("group", { name: "Examples" }).getByRole("button").nth(1).click();
  await page.getByRole("button", { name: "Get a link" }).click({ timeout: 90_000 });
  await expect(page.getByLabel("Your link")).toHaveValue("https://example.test/a/abc");
  await expect(page.getByText(/for 7 days, then it is deleted/)).toBeVisible();
});

test("the button is hidden when the server cannot keep links", async ({ page }) => {
  test.setTimeout(120_000);
  await page.route("**/api/share", (route) => route.fulfill({ json: { available: false } }));
  await page.goto("/");
  await page.getByRole("group", { name: "Examples" }).getByRole("button").nth(1).click();
  await expect(page.getByText("Save the app").first()).toBeVisible({ timeout: 90_000 });
  await expect(page.getByRole("button", { name: "Get a link" })).toHaveCount(0);
});

test("an app link that does not exist answers with the same sealed page, never the site", async ({
  request,
}) => {
  for (const id of ["A".repeat(22), "short", "..%2F..%2Fadmin"]) {
    const res = await request.get(`/a/${id}`);
    expect(res.status()).toBe(404);
    const h = res.headers();
    expect(h["content-security-policy"]).toContain("sandbox allow-scripts");
    expect(h["content-security-policy"]).not.toContain("allow-same-origin");
    expect(h["x-robots-tag"]).toBe("noindex, nofollow");
    expect(h["cache-control"]).toBe("private, no-store");
    expect(await res.text()).toContain("expired or was never saved");
  }
});
