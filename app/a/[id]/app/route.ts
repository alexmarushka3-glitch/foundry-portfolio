import { withHostedShim } from "@/lib/previewShim";
import { checkSharedApp } from "@/lib/server/shareCheck";
import { appHeaders, gone, unavailable } from "@/lib/server/sharePage";
import { SHARE_ID } from "@/lib/server/shareStore";
import { serverState } from "@/lib/server/state";

export const runtime = "nodejs";

// The app of a hosted link, served sealed (lib/securityHeaders.ts sharedAppHeaders): an opaque origin with no cookies,
// storage or network, set in the response headers because a sandbox that only a <meta> tag asks for does not hold.
// It is meant to be shown inside the wrapper at /a/<id>. Opened on its own (a top-level page), the wrapper's lock on
// where it can navigate would be missing, so that is sent to the wrapper instead.

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!SHARE_ID.test(id)) return gone();
  // Browsers say how a page is being loaded. Anything but a frame goes to the wrapper (an old browser that sends
  // nothing does too; the wrapper cannot be framed, so that never loops).
  if (req.headers.get("sec-fetch-dest") !== "iframe") {
    return new Response(null, {
      status: 302,
      headers: { Location: `/a/${id}`, "Cache-Control": "no-store" },
    });
  }
  const state = serverState();
  let html: string | null;
  try {
    html = await state.shares.get(id);
  } catch {
    return unavailable();
  }
  if (html === null) return gone();
  // The rules run again on every open, so a rule added later also covers links that already exist.
  if (!checkSharedApp(html).ok) {
    await state.shares.remove(id).catch(() => false);
    return gone();
  }
  return new Response(withHostedShim(html), {
    headers: { ...appHeaders(), "Content-Type": "text/html; charset=utf-8" },
  });
}
