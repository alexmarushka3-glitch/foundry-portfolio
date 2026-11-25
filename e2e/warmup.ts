import type { FullConfig } from "@playwright/test";

// `npm run dev` compiles each route the first time it is asked for. Whichever test reaches a route first then waits for
// that compile (seconds, longer on a busy machine) while its own checks give up after 5 seconds. That made tests like
// "an app that tries to send the visitor to another website is stopped by the browser" fail when run alone or first.
// This runs once, after the dev server is up and before any test: it asks for each route the tests use, with a long
// timeout of its own, so no test pays for a compile. It checks nothing and never fails the run: a broken route still
// fails its own test. It does nothing against a deployed site (BASE_URL), which is already compiled.

const HOSTED_ID = "A".repeat(22); // an id that is not a stored link (the same one the hosted-link tests use)

const ROUTES: { path: string; headers?: Record<string, string> }[] = [
  { path: "/" },
  { path: "/admin-demo" },
  { path: "/admin" },
  { path: "/nope-404" },
  { path: "/api/run" },
  { path: "/api/share" }, // the home page asks it whether links are on, in every demo test
  { path: `/a/${HOSTED_ID}` },
  // the framed app page: without this header it redirects to the wrapper instead of rendering
  { path: `/a/${HOSTED_ID}/app`, headers: { "sec-fetch-dest": "iframe" } },
  // the catch-all route that answers ids that could never be a link ("short", an extra path part, none at all)
  { path: "/a/short" },
  { path: `/a/${HOSTED_ID}/other` },
  { path: "/a/" },
];

const PER_ROUTE_MS = 60_000;
const TOTAL_MS = 150_000;

export default async function globalSetup(config: FullConfig) {
  if (process.env.BASE_URL) return;
  const base = config.projects[0]?.use.baseURL ?? "http://localhost:3000";
  const deadline = Date.now() + TOTAL_MS;
  const skipped: string[] = [];
  // one at a time: the dev server compiles in a queue anyway, and this keeps the load low
  for (const { path, headers } of ROUTES) {
    if (Date.now() > deadline) {
      skipped.push(path);
      continue;
    }
    try {
      await fetch(new URL(path, base), {
        headers,
        redirect: "manual",
        signal: AbortSignal.timeout(PER_ROUTE_MS),
      });
    } catch {
      skipped.push(path);
    }
  }
  if (skipped.length) {
    console.warn(
      `warm-up: no answer in time for ${skipped.join(", ")}; tests may pay for those compiles`,
    );
  }
}
