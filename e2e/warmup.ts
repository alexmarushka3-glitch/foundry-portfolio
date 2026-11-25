import type { FullConfig } from "@playwright/test";

// `npm run dev` compiles each route the first time it is asked for. Whichever test reaches a route first then waits for
// that compile (seconds, longer on a busy machine) while its own checks give up after 5 seconds. That made tests like
// "an app that tries to send the visitor to another website is stopped by the browser" fail when run alone or first.
// This runs once, after the server is up and before any test: it asks for each route the tests use, with a long
// timeout of its own, so no test pays for a compile. It checks nothing and never fails the run (a deployed site just
// answers quickly). No test or timeout is changed.

const HOSTED_ID = "A".repeat(22); // an id that is not a stored link (the same one the hosted-link tests use)

const ROUTES: { path: string; headers?: Record<string, string> }[] = [
  { path: "/" },
  { path: "/admin-demo" },
  { path: "/admin" },
  { path: "/nope-404" },
  { path: `/a/${HOSTED_ID}` },
  // the framed app page: without this header it redirects to the wrapper instead of rendering
  { path: `/a/${HOSTED_ID}/app`, headers: { "sec-fetch-dest": "iframe" } },
  { path: `/a/${HOSTED_ID}/manifest.webmanifest` },
  { path: "/pwa-icon/192" },
  { path: "/opengraph-image" },
  { path: "/api/run" },
  { path: "/api/share" },
];

export default async function globalSetup(config: FullConfig) {
  const base = config.projects[0]?.use.baseURL ?? process.env.BASE_URL ?? "http://localhost:3000";
  // one at a time: the dev server compiles in a queue anyway, and this keeps the load low
  for (const { path, headers } of ROUTES) {
    try {
      await fetch(new URL(path, base), {
        headers,
        redirect: "manual",
        signal: AbortSignal.timeout(90_000),
      });
    } catch {
      // a slow or missing route is the tests' business, not the warm-up's
    }
  }
}
