import { buildOverview } from "@/lib/admin/overview";
import { requireAdmin } from "@/lib/server/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  return Response.json(buildOverview(), { headers: { "Cache-Control": "no-store" } });
}
