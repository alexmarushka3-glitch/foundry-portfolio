import { buildSandboxSnapshot, snapshotBuilding } from "@/lib/pipeline/snapshotBuild";
import { requireAdmin } from "@/lib/server/adminAuth";

export const runtime = "nodejs";
export const maxDuration = 180; // a build takes about 30 to 60 seconds

/** GET: is the snapshot id this deployment uses set, and is a build running. The id itself is never sent. */
export async function GET(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  return Response.json(
    { configured: Boolean(process.env.FOUNDRY_SANDBOX_SNAPSHOT), building: snapshotBuilding() },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** POST: build a new sandbox snapshot from inside this deployment and return its id. Admin only, one at a time. */
export async function POST(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  if (snapshotBuilding()) return Response.json({ error: "A build is already running." }, { status: 409 });
  try {
    const result = await buildSandboxSnapshot();
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("snapshot build failed:", (err as Error).name, String((err as Error).message).slice(0, 300));
    return Response.json({ error: `The build failed: ${String((err as Error).message).slice(0, 200)}` }, { status: 500 });
  }
}
