import { SHARE_ID } from "@/lib/server/shareStore";
import { shareEnabled } from "@/lib/server/env";
import { wrapper, wrapperGone, wrapperOff } from "@/lib/server/sharePage";

export const runtime = "nodejs";

// A hosted app link. This page is the site's own markup around one frame; the app itself is served, sealed, at
// /a/<id>/app. The wrapper's policy lets that frame load only this site's own copy, so an app that tries to send the
// visitor to another website is stopped by the browser (see SHARED_WRAPPER_CONTENT_SECURITY_POLICY). It asks the
// database nothing: an unknown or expired id shows its notice inside the frame.

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!SHARE_ID.test(id)) return wrapperGone();
  if (!shareEnabled()) return wrapperOff(); // switched off: no frame, so nothing is asked of the database
  return wrapper(id);
}
