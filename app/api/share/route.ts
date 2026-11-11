import { bundleApp } from "@/lib/bundle";
import {
  MAX_SHARE_BODY_BYTES,
  MAX_SHARE_BYTES,
  MAX_SHARE_FILES,
  MAX_SHARE_NAME,
  SHARE_TTL_SECONDS,
} from "@/lib/share";
import { blockCrossSite } from "@/lib/server/adminAuth";
import { shareEnabled } from "@/lib/server/env";
import { isShippedApp } from "@/lib/server/liveRecordings";
import { readJsonBody, visitorAddress } from "@/lib/server/runApi";
import { checkSharedApp, refusedMessage } from "@/lib/server/shareCheck";
import { prepareWithin } from "@/lib/server/shareSigner";
import { newShareId } from "@/lib/server/shareStore";
import { serverState } from "@/lib/server/state";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: NO_STORE });

/** The files of a finished app, if `value` is shaped like them: a few short names, each with text. */
function asFiles(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const entries = Object.entries(value);
  if (entries.length === 0 || entries.length > MAX_SHARE_FILES) return null;
  const files: Record<string, string> = {};
  for (const [name, text] of entries) {
    if (typeof text !== "string" || name.length === 0 || name.length > MAX_SHARE_NAME) return null;
    files[name] = text;
  }
  return files;
}

/** Tells the page whether links can be made. They need the database, so without it the button stays hidden. */
export async function GET() {
  return json({ available: shareEnabled() && serverState().shares.persistent });
}

/**
 * Keeps a finished app for a week and returns its link. The page sends the app's files and the signature the server
 * gave them when the run finished; the server checks it and builds the page itself, so only apps that really came from
 * a Foundry run (or match a shipped recording) can get a link.
 */
export async function POST(req: Request) {
  const crossSite = blockCrossSite(req);
  if (crossSite) return crossSite;
  const state = serverState();
  if (!shareEnabled() || !state.shares.persistent)
    return json({ error: "Links aren't available right now." }, 503);

  // The body is the app's files as JSON, where every quote and line break takes two bytes, so the cap is well above the
  // app's own size and the exact check on the built page below gives the friendly message.
  const read = await readJsonBody(req, MAX_SHARE_BODY_BYTES);
  if (!read.ok) return json({ error: read.error }, read.status);
  const body = read.body as { files?: unknown; sig?: unknown } | null;
  const files = asFiles(body?.files);
  if (!files) {
    // A page opened before an update still sends the old shape (the page's html); tell it to reload.
    if (typeof (body as { html?: unknown } | null)?.html === "string")
      return json(
        { error: "This page is out of date. Reload it, build the app again, then get a link." },
        400,
      );
    return json({ error: "That doesn't look like a finished app." }, 400);
  }

  // Only apps that came from a real run: a recording the site ships, or files the server signed when the run ended.
  if (!isShippedApp(files)) {
    if (!(await prepareWithin(state.shareSigner, 3000)))
      return json({ error: "Could not make a link right now. Try Save the app." }, 503);
    // The key may have been replaced since this instance loaded it (deleted, or the database reset), so look again
    // before saying no.
    const signed =
      state.shareSigner.verify(files, body?.sig) ||
      ((await state.shareSigner.refresh()) && state.shareSigner.verify(files, body?.sig));
    if (!signed)
      return json(
        { error: "Only apps built here on Foundry can get a link. Try Save the app." },
        403,
      );
  }

  let html: string;
  try {
    html = bundleApp(files);
  } catch {
    return json({ error: "That doesn't look like a finished app." }, 400);
  }
  if (new TextEncoder().encode(html).length > MAX_SHARE_BYTES)
    return json({ error: "That app is too large for a link. Save it instead." }, 413);

  const checked = checkSharedApp(html);
  if (!checked.ok) return json({ error: refusedMessage(checked.reason) }, 422);

  const address = visitorAddress(req.headers);
  let counted = false;
  try {
    const refused = await state.shareBrake.check(address);
    if (refused) return json({ error: refused }, 429);
    counted = true;
    const id = newShareId();
    await state.shares.put(id, html, SHARE_TTL_SECONDS);
    return json({
      id,
      url: `${new URL(req.url).origin}/a/${id}`,
      expiresAt: new Date(Date.now() + SHARE_TTL_SECONDS * 1000).toISOString(),
    });
  } catch (err) {
    // The link was allowed but could not be saved, so it must not cost the visitor or the site a slot.
    if (counted) await state.shareBrake.release(address).catch(() => {});
    console.warn(
      `share: could not make a link (${err instanceof Error ? err.message : "unknown"})`,
    );
    return json({ error: "Could not make a link right now. Try Save the app." }, 503);
  }
}
