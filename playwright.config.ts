import { defineConfig } from "@playwright/test";

// UI tests in a real browser. They never call a live model: they use the recorded examples and static pages.
//   npm run test:ui                                   local: starts `next dev` on :3000 (or reuses it)
//   BASE_URL=https://foundry-portfolio.vercel.app npm run test:ui   against the deployed site
// They use the Chrome installed on this machine, so no browser download is needed.
const baseURL = process.env.BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: 0,
  reporter: [["list"]],
  use: { baseURL, channel: "chrome", trace: "retain-on-failure" },
  webServer: process.env.BASE_URL
    ? undefined
    : { command: "npm run dev", url: baseURL, reuseExistingServer: true, timeout: 120_000 },
});
