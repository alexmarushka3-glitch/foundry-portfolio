import { withHostedShim } from "@/lib/previewShim";
import { checkSharedApp } from "@/lib/server/shareCheck";
import { shareEnabled } from "@/lib/server/env";
import { appHeaders, gone, off, unavailable } from "@/lib/server/sharePage";
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
  if (!shareEnabled()) return off(); // the off switch also stops serving links that already exist
  // Browsers say how a page is being loaded. Anything but a frame goes to the wrapper. A browser that sends nothing
  // (Safari before 16.4, or a proxy that strips it) gets that redirect inside the wrapper's frame, where the wrapper's
  // frame-ancestors 'none' refuses it: a blank frame, never the unlocked app. That fails closed on purpose.
  if (req.headers.get("sec-fetch-dest") !== "iframe") {
    return new Response(null, {
      status: 302,
      headers: { Location: `/a/${id}`, "Cache-Control": "no-store", Vary: "Sec-Fetch-Dest" },
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
    headers: {
      ...appHeaders(),
      "Content-Type": "text/html; charset=utf-8",
      Vary: "Sec-Fetch-Dest", // the redirect above depends on this header, so no cache may mix the two answers
    },
  });
}
