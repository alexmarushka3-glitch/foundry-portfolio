import { ADMIN_ACTIONS } from "@/lib/admin/actions";
import { buildOverview } from "@/lib/admin/overview";
import { requireAdmin } from "@/lib/server/adminAuth";
import { readJsonBody } from "@/lib/server/runApi";
import { serverState } from "@/lib/server/state";

export const runtime = "nodejs";

/** The dashboard's key actions. Each returns the fresh overview so the page can update in one round trip. */
export async function POST(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const read = await readJsonBody(req);
  if (!read.ok) return Response.json({ error: read.error }, { status: read.status });
  const action = ADMIN_ACTIONS.find((a) => a === (read.body as { action?: unknown } | null)?.action);
  if (!action) return Response.json({ error: "Unknown action." }, { status: 400 });

  const state = serverState();
  switch (action) {
    case "pause-live":
      state.admin.livePaused = true;
      break;
    case "resume-live":
      state.admin.livePaused = false;
      break;
    case "reset-limits":
      state.liveLimiter.reset();
      break;
    case "clear-log":
      state.runLog.clear();
      break;
  }
  return Response.json(buildOverview(), { headers: { "Cache-Control": "no-store" } });
}
