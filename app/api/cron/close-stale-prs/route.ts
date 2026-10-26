import { createGithubClient, githubConfigured, STALE_AFTER_MS } from "@/lib/pipeline/github";
import { timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

/** Vercel Cron calls this once a day. Closes Foundry's pull requests on taskly-sample that are over a day old. */
export async function GET(req: Request) {
  // Without CRON_SECRET the route does not exist, so nobody can trigger it by guessing the address.
  if (!process.env.CRON_SECRET?.trim()) return new Response("Not found", { status: 404 });
  if (!authorized(req)) return Response.json({ error: "Not allowed." }, { status: 401 });
  if (!githubConfigured()) return Response.json({ closed: 0, note: "GitHub is not set up." });
  try {
    return Response.json(await createGithubClient().closeStale(STALE_AFTER_MS), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("closing stale pull requests failed:", (err as Error).name, String((err as Error).message).slice(0, 200));
    return Response.json({ error: "Could not close stale pull requests." }, { status: 500 });
  }
}
