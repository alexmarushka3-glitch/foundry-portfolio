import { MAX_SHARE_BYTES, SHARE_TTL_SECONDS } from "@/lib/share";
import { blockCrossSite } from "@/lib/server/adminAuth";
import { readJsonBody, visitorAddress } from "@/lib/server/runApi";
import { checkSharedApp, refusedMessage } from "@/lib/server/shareCheck";
import { newShareId } from "@/lib/server/shareStore";
import { serverState } from "@/lib/server/state";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: NO_STORE });

/** Tells the page whether links can be made. They need the database, so without it the button stays hidden. */
export async function GET() {
  return json({ available: serverState().shares.persistent });
}

/** Keeps a finished app for a week and returns its link. The app is the one .html file the page already shows. */
export async function POST(req: Request) {
  const crossSite = blockCrossSite(req);
  if (crossSite) return crossSite;
  const state = serverState();
  if (!state.shares.persistent) return json({ error: "Links aren't available right now." }, 503);

  // The body is the app's html wrapped in a little JSON, so allow a bit over the app's own size.
  const read = await readJsonBody(req, MAX_SHARE_BYTES + 1024);
  if (!read.ok) return json({ error: read.error }, read.status);
  const html = (read.body as { html?: unknown } | null)?.html;
  if (typeof html !== "string" || !/<!doctype html|<html/i.test(html))
    return json({ error: "That doesn't look like a finished app." }, 400);
  if (new TextEncoder().encode(html).length > MAX_SHARE_BYTES)
    return json({ error: "That app is too large for a link. Save it instead." }, 413);

  const checked = checkSharedApp(html);
  if (!checked.ok) return json({ error: refusedMessage(checked.reason) }, 422);

  try {
    const refused = await state.shareBrake.check(visitorAddress(req.headers));
    if (refused) return json({ error: refused }, 429);
    const id = newShareId();
    await state.shares.put(id, html, SHARE_TTL_SECONDS);
    return json({
      id,
      url: `${new URL(req.url).origin}/a/${id}`,
      expiresAt: new Date(Date.now() + SHARE_TTL_SECONDS * 1000).toISOString(),
    });
  } catch (err) {
    console.warn(
      `share: could not make a link (${err instanceof Error ? err.message : "unknown"})`,
    );
    return json({ error: "Could not make a link right now. Try Save the app." }, 503);
  }
}
