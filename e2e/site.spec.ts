import { expect, test, type Page } from "@playwright/test";
import { sharedAppHeaders } from "../lib/securityHeaders";

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

test("the How it works picture shows one drawing at a time and fits the phone", async ({
  page,
}) => {
  await page.goto("/");
  const fig = page.locator("figure.hiw");
  await fig.scrollIntoViewIfNeeded();
  await expect(fig.locator("svg.hiw-wide")).toBeVisible();
  await expect(fig.locator("svg.hiw-narrow")).toBeHidden();
  await page.setViewportSize({ width: 390, height: 800 });
  await expect(fig.locator("svg.hiw-narrow")).toBeVisible();
  await expect(fig.locator("svg.hiw-wide")).toBeHidden();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(overflow).toBe(false);
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

test(
  "Open full screen shows the finished app in its own sealed tab",
  { tag: "@phone" },
  async ({ page, context }) => {
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
  },
);

test(
  "Open full screen says so, with a way out, when the frame never opens the app",
  { tag: "@phone" },
  async ({ page, context }) => {
    test.setTimeout(120_000);
    // A frame that loads but never starts the app (what iPhone Safari did before the script was inlined).
    await context.route("**/preview/frame.html", (route) =>
      route.fulfill({ contentType: "text/html", body: "<p>Opening the app…</p>" }),
    );
    await page.goto("/");
    await page.getByRole("group", { name: "Examples" }).getByRole("button").nth(1).click();
    await expect(page.getByText("Save the app").first()).toBeVisible({ timeout: 90_000 });
    // The stub never answers, so the page itself needs no frame to announce itself; the full-screen tab does the work.
    const [tab] = await Promise.all([
      context.waitForEvent("page"),
      page.getByRole("button", { name: "Open full screen" }).click(),
    ]);
    await expect(tab.getByText("The app did not open in this browser")).toBeVisible({
      timeout: 15_000,
    });
    await expect(tab.getByRole("button", { name: "Save the app" })).toBeVisible();
    await expect(tab.getByRole("button", { name: "Copy the code" })).toBeVisible();
  },
);

// The frame stub below stands in for /preview/frame.html. It runs inside the sealed frame, so it can only talk to
// the page with postMessage, the same way the real frame does.
async function openFullWithFrame(
  page: import("@playwright/test").Page,
  context: import("@playwright/test").BrowserContext,
  frameBody: string,
) {
  await context.route("**/preview/frame.html", (route) =>
    route.fulfill({ contentType: "text/html", body: frameBody }),
  );
  await page.goto("/");
  await page.getByRole("group", { name: "Examples" }).getByRole("button").nth(1).click();
  await expect(page.getByText("Save the app").first()).toBeVisible({ timeout: 90_000 });
  const [tab] = await Promise.all([
    context.waitForEvent("page"),
    page.getByRole("button", { name: "Open full screen" }).click(),
  ]);
  return tab;
}

test(
  "Open full screen says so, with all three buttons, when the frame loads but the app never starts",
  { tag: "@phone" },
  async ({ page, context }) => {
    test.setTimeout(120_000);
    const tab = await openFullWithFrame(
      page,
      context,
      `<p>Opening the app…</p><script>parent.postMessage({ type: "preview-loaded" }, "*");</script>`,
    );
    await expect(tab.getByText("The app did not open in this browser")).toBeVisible({
      timeout: 15_000,
    });
    await expect(tab.getByRole("button", { name: "Save the app" })).toBeVisible();
    await expect(tab.getByRole("button", { name: "Copy the code" })).toBeVisible();
    await expect(tab.getByRole("button", { name: "Try again" })).toBeVisible();
  },
);

test(
  "Open full screen takes the message away again when the app opens, only slowly",
  { tag: "@phone" },
  async ({ page, context }) => {
    test.setTimeout(120_000);
    const tab = await openFullWithFrame(
      page,
      context,
      `<p>Slow app</p><script>
      parent.postMessage({ type: "preview-loaded" }, "*");
      setTimeout(() => parent.postMessage({ type: "preview-ready" }, "*"), 8000);
    </script>`,
    );
    await expect(tab.getByText("The app did not open in this browser")).toBeVisible({
      timeout: 15_000,
    });
    await expect(tab.getByText("The app did not open in this browser")).toBeHidden({
      timeout: 15_000,
    });
    await expect(tab.frameLocator("#app").getByText("Slow app")).toBeVisible();
  },
);

test(
  "Open full screen keeps the message when the app says it could not start",
  { tag: "@phone" },
  async ({ page, context }) => {
    test.setTimeout(120_000);
    const tab = await openFullWithFrame(
      page,
      context,
      `<p>Broken</p><script>
      parent.postMessage({ type: "preview-loaded" }, "*");
      parent.postMessage({ type: "preview-error", fatal: true, message: "boom" }, "*");
      setTimeout(() => parent.postMessage({ type: "preview-ready" }, "*"), 500);
    </script>`,
    );
    await expect(tab.getByText("The app did not open in this browser")).toBeVisible({
      timeout: 15_000,
    });
    await tab.waitForTimeout(1500); // a "ready" after a failure must not take the message away
    await expect(tab.getByText("The app did not open in this browser")).toBeVisible();
  },
);

test(
  "the on-page preview says so, with ways out, when the frame never starts the app",
  { tag: "@phone" },
  async ({ page, context }) => {
    test.setTimeout(120_000);
    await context.route("**/preview/frame.html", (route) =>
      route.fulfill({ contentType: "text/html", body: "<p>Opening the app…</p>" }),
    );
    await page.goto("/");
    await page.getByRole("group", { name: "Examples" }).getByRole("button").nth(1).click();
    await expect(page.getByText("Save the app").first()).toBeVisible({ timeout: 90_000 });
    await expect(page.getByText("the preview did not start in this browser")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole("button", { name: "Open full screen" })).toBeVisible();
  },
);

test(
  "the on-page preview keeps running when the app throws a harmless error after it started",
  { tag: "@phone" },
  async ({ page, context }) => {
    test.setTimeout(120_000);
    // A stand-in frame: it opens the app, then reports an uncaught error the way frame.html does (not marked fatal).
    await context.route("**/preview/frame.html", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: `<p>Stand-in</p><script>
          parent.postMessage({ type: "preview-loaded" }, "*");
          parent.postMessage({ type: "preview-ready" }, "*");
          setTimeout(() => parent.postMessage({ type: "preview-error", message: "a click handler threw" }, "*"), 300);
        </script>`,
      }),
    );
    await page.goto("/");
    await page.getByRole("group", { name: "Examples" }).getByRole("button").nth(1).click();
    await expect(page.getByText("Save the app").first()).toBeVisible({ timeout: 90_000 });
    await page.waitForTimeout(1500);
    await expect(page.getByText("The app hit an error")).toHaveCount(0);
  },
);

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
      const sent = route.request().postDataJSON() as { files: Record<string, string> };
      expect(Object.keys(sent.files).length).toBeGreaterThan(0); // the files, never page text the client wrote
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

const GONE_ID = "A".repeat(22);

test(
  "an app link that does not exist shows a sealed notice inside the locked frame, never the site",
  { tag: "@lock" },
  async ({ page, request }) => {
    // The page a link opens is only a frame; the notice comes from the app page, sealed like any app.
    const wrapper = await request.get(`/a/${GONE_ID}`);
    expect(wrapper.status()).toBe(200);
    expect(wrapper.headers()["content-security-policy"]).toContain("frame-src 'self'");
    const app = await page.request.get(`/a/${GONE_ID}/app`, {
      headers: { "sec-fetch-dest": "iframe" },
    });
    expect(app.status()).toBe(404);
    const h = app.headers();
    expect(h["content-security-policy"]).toContain("sandbox allow-scripts");
    expect(h["content-security-policy"]).not.toContain("allow-same-origin");
    expect(h["x-robots-tag"]).toBe("noindex, nofollow");
    expect(h["cache-control"]).toBe("private, no-store");
    expect(await app.text()).toContain("expired or was never saved");
    // an id that could never be a link gets a plain 404 page with no frame at all
    for (const id of ["short", `${GONE_ID}/other`, ""]) {
      const res = await request.get(`/a/${id}`);
      expect(res.status()).toBe(404);
      expect(await res.text()).not.toContain("<iframe");
    }
    // An encoded slash (a path-traversal look-alike) is refused: by our code (404), or by Vercel's edge, which answers 400
    // before the request reaches the app. Either way it never shows a frame or the app.
    const traversal = await request.get(`/a/..%2F..%2Fadmin`);
    expect([400, 404]).toContain(traversal.status());
    expect(await traversal.text()).not.toContain("<iframe");
    // in a real browser the notice appears inside the frame
    await page.goto(`/a/${GONE_ID}`);
    await expect(page.frameLocator("iframe").getByText("expired or was never saved")).toBeVisible();
  },
);

test(
  "opening the app page on its own sends the visitor to the locked wrapper",
  { tag: "@lock" },
  async ({ page }) => {
    await page.goto(`/a/${GONE_ID}/app`);
    expect(new URL(page.url()).pathname).toBe(`/a/${GONE_ID}`);
    await expect(page.locator("iframe")).toHaveCount(1);
  },
);

test(
  "an app that tries to send the visitor to another website is stopped by the browser",
  { tag: "@lock" },
  async ({ page }) => {
    // The app page is faked here (this site has no stored link to use without a database), with the real sealed
    // headers. The wrapper is the real one, so the lock under test is the one visitors get.
    const sealed = Object.fromEntries(sharedAppHeaders().map((x) => [x.key, x.value]));
    await page.route(`**/a/${GONE_ID}/app`, (route) =>
      route.fulfill({
        status: 200,
        headers: { ...sealed, "Content-Type": "text/html; charset=utf-8" },
        body: '<!doctype html><title>x</title><h1 id="stayed">Still here</h1><script>setTimeout(function () { location.href = "https://example.com/"; }, 200);</script>',
      }),
    );
    const reached: string[] = [];
    page.on("request", (r) => {
      if (r.url().startsWith("https://example.com")) reached.push(r.url());
    });
    // Every engine tells the page that framed the app when its policy refuses something. Record those events.
    await page.addInitScript(() => {
      const seen: string[] = [];
      (window as unknown as { __csp: string[] }).__csp = seen;
      document.addEventListener("securitypolicyviolation", (e) => {
        seen.push(`${e.violatedDirective} ${e.blockedURI}`);
      });
    });
    await page.goto(`/a/${GONE_ID}`);
    await expect(page.frameLocator("iframe").locator("#stayed")).toBeVisible();
    await expect
      .poll(
        () => page.evaluate(() => (window as unknown as { __csp: string[] }).__csp.join("\n")),
        {
          timeout: 10_000,
        },
      )
      .toMatch(/frame-src[^\n]*example\.com/i);
    expect(page.frames().some((f) => f.url().startsWith("https://example.com"))).toBe(false);
    expect(reached).toEqual([]);
  },
);

test(
  "the on-page preview shows the finished app, on a phone too",
  { tag: "@phone" },
  async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/");
    await page.getByRole("group", { name: "Examples" }).getByRole("button").nth(1).click();
    await expect(page.getByText("Save the app").first()).toBeVisible({ timeout: 90_000 });
    const app = page.frameLocator('iframe[src="/preview/frame.html"]');
    await expect(app.locator("h1, h2").first()).toBeVisible({ timeout: 15_000 });
  },
);
