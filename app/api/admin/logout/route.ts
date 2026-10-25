import { sessionCookie } from "@/lib/server/adminAuth";

export const runtime = "nodejs";

export async function POST() {
  return Response.json({ ok: true }, { headers: { "Set-Cookie": sessionCookie("", 0), "Cache-Control": "no-store" } });
}
