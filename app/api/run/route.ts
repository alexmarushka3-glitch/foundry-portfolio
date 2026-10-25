import { liveEnabled, runPipeline } from "@/lib/pipeline";
import { findRecording } from "@/lib/run";
import type { FoundryEvent } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120; // two-round live runs have taken over 40 seconds

const MAX_INPUT = 200;
// A live run costs roughly 5 to 10 cents, so these keep a bad day to a few dollars.
const PER_HOUR = Number(process.env.FOUNDRY_LIVE_PER_HOUR ?? 3);
const PER_DAY = Number(process.env.FOUNDRY_LIVE_PER_DAY ?? 40);

// In-memory counters. On serverless hosting each instance keeps its own, so these are a
// best-effort brake, not a hard cap. The hard cap is the spend limit set in the Anthropic console.
const hits = new Map<string, number[]>();
const dayStart = { t: Date.now(), count: 0 };

function overLimit(ip: string): string | null {
  const now = Date.now();
  if (now - dayStart.t > 86_400_000) {
    dayStart.t = now;
    dayStart.count = 0;
  }
  if (dayStart.count >= PER_DAY) return "Today's live runs are used up, so this one is a simulation.";
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 3_600_000);
  if (recent.length >= PER_HOUR) {
    hits.set(ip, recent);
    return `You've used ${PER_HOUR} live runs this hour, so this one is a simulation.`;
  }
  recent.push(now);
  hits.set(ip, recent);
  dayStart.count += 1;
  return null;
}

/** Tells the page whether typed ideas can run live. */
export async function GET() {
  return Response.json({ live: liveEnabled() });
}

export async function POST(req: Request) {
  let request = "";
  try {
    const body = (await req.json()) as { request?: unknown };
    // Strip control characters so odd input can't mangle the prompt or the stream.
    request = typeof body.request === "string" ? body.request.replace(/[\u0000-\u001f\u007f]/g, " ").trim() : "";
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!request) return Response.json({ error: "Type an idea first." }, { status: 400 });
  if (request.length > MAX_INPUT) return Response.json({ error: `Keep it under ${MAX_INPUT} characters.` }, { status: 400 });

  // Recorded examples never cost anything, so only typed ideas count against the limits.
  let allowLive = true;
  let reason: string | undefined;
  if (liveEnabled() && !findRecording(request)) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    reason = overLimit(ip) ?? undefined;
    allowLive = !reason;
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: FoundryEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      try {
        await runPipeline(request, emit, { allowLive, reason });
      } catch (err) {
        // Log the cause for me (type, status, a trimmed message with anything key-shaped removed).
        const e = err as { name?: string; status?: number; message?: string; error?: { error?: { type?: string } } };
        console.error(
          "run failed:",
          e?.name ?? typeof err,
          e?.status ?? "",
          e?.error?.error?.type ?? "",
          String(e?.message ?? "").replace(/sk-[A-Za-z0-9_-]{8,}/g, "[key]").slice(0, 200),
        );
        // Show our own messages, never raw API errors, which can include request details.
        const message = err instanceof Error && err.message.length < 140 && !/api|key|auth|token/i.test(err.message)
          ? err.message
          : "The run stopped before it finished. Try again in a moment.";
        emit({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
