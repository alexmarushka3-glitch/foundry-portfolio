import { defineConfig } from "@playwright/test";

// UI tests in a real browser. They never call a live model: they use the recorded examples and static pages.
//   npm run test:ui                                   Chrome (the one installed on this machine); starts `next dev`
//   BASE_URL=https://foundry-portfolio.vercel.app npm run test:ui   the same against a deployed site
//   npm run test:ui:browsers                          Firefox and WebKit, only the tests tagged @lock (the frame lock
//                                                     that keeps a hosted app from sending the visitor elsewhere)
// Firefox and WebKit need a one-time download: npx playwright install firefox webkit
const baseURL = process.env.BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: 0,
  reporter: [["list"]],
  use: { baseURL, trace: "retain-on-failure" },
  projects: [
    { name: "chrome", use: { channel: "chrome" } },
    { name: "firefox", use: { browserName: "firefox" }, grep: /@lock/ },
    { name: "webkit", use: { browserName: "webkit" }, grep: /@lock/ },
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : { command: "npm run dev", url: baseURL, reuseExistingServer: true, timeout: 120_000 },
});
