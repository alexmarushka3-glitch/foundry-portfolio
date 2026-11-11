import { requireAdmin } from "@/lib/server/adminAuth";
import { readJsonBody } from "@/lib/server/runApi";
import { shareIdFrom } from "@/lib/server/shareStore";
import { serverState } from "@/lib/server/state";

export const runtime = "nodejs";

/** Takes one hosted app link down right now. The admin pastes the link; nothing else is listed or kept. */
export async function POST(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const read = await readJsonBody(req);
  if (!read.ok) return Response.json({ error: read.error }, { status: read.status });
  const id = shareIdFrom((read.body as { link?: unknown } | null)?.link);
  if (!id) return Response.json({ error: "That isn't a link made by this site." }, { status: 400 });
  try {
    const removed = await serverState().shares.remove(id);
    return Response.json({ removed }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Could not reach the database." }, { status: 503 });
  }
}
