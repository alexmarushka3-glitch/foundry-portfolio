import { adminEnabled, blockCrossSite, sessionCookie, sessionValue, tokenMatches } from "@/lib/server/adminAuth";
import { readJsonBody, visitorAddress } from "@/lib/server/runApi";
import { serverState } from "@/lib/server/state";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!adminEnabled()) return new Response("Not found", { status: 404 });
  const crossSite = blockCrossSite(req);
  if (crossSite) return crossSite;

  // Slow down guessing: five tries per address per 15 minutes.
  if (!serverState().loginLimiter.hit(visitorAddress(req.headers))) {
    return Response.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
  }

  const read = await readJsonBody(req);
  if (!read.ok) return Response.json({ error: read.error }, { status: read.status });
  const body = read.body as { token?: unknown } | null;
  const token = typeof body?.token === "string" ? body.token : "";
  const session = sessionValue();
  if (!token || !session || !tokenMatches(token)) {
    return Response.json({ error: "That token isn't right." }, { status: 401 });
  }
  return Response.json({ ok: true }, { headers: { "Set-Cookie": sessionCookie(session), "Cache-Control": "no-store" } });
}
