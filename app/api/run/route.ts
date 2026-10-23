import { findRecording, hasLiveKey, runPipeline, type FoundryEvent } from "@/lib/pipeline";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_INPUT = 200;
const LIVE_RUNS_PER_HOUR = 5;
const hits = new Map<string, number[]>();

// Live runs spend real money, so cap them per IP. Simulated runs are free and unlimited.
function overLimit(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 3_600_000);
  if (recent.length >= LIVE_RUNS_PER_HOUR) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

export async function POST(req: Request) {
  let request = "";
  try {
    const body = (await req.json()) as { request?: unknown };
    request = typeof body.request === "string" ? body.request.trim() : "";
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!request) return Response.json({ error: "Request is required" }, { status: 400 });
  if (request.length > MAX_INPUT)
    return Response.json({ error: `Keep it under ${MAX_INPUT} characters` }, { status: 400 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (hasLiveKey() && !findRecording(request) && overLimit(ip))
    return Response.json({ error: "Live demo limit reached. Try again in an hour." }, { status: 429 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: FoundryEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      try {
        await runPipeline(request, emit);
      } catch (err) {
        emit({ type: "error", message: err instanceof Error ? err.message : "Pipeline failed" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
