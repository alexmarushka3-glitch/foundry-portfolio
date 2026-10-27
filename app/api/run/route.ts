import { encodeEvent } from "@/lib/ndjson";
import { liveEnabled, runPipeline } from "@/lib/pipeline";
import { findServerRecording } from "@/lib/server/liveRecordings";
import { createRecorder, hashVisitor } from "@/lib/server/runLog";
import { logRunFailure, parseRequest, readJsonBody, visitorAddress, visitorMessage } from "@/lib/server/runApi";
import { serverState } from "@/lib/server/state";
import type { FoundryEvent } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 200; // live runs with tools take 55 to 70 seconds; a second round adds about as much

/** Tells the page whether requests built in the form can run live. */
export async function GET() {
  return Response.json({ live: liveEnabled() });
}

export async function POST(req: Request) {
  const read = await readJsonBody(req);
  if (!read.ok) return Response.json({ error: read.error }, { status: read.status });
  const parsed = parseRequest(read.body);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  const { request } = parsed;

  const state = serverState();
  const address = visitorAddress(req.headers);

  // Recorded examples never cost anything, so only other requests count against the limits.
  let allowLive = true;
  let reason: string | undefined;
  if (liveEnabled() && !findServerRecording(request)) {
    reason = (await state.liveLimiter.check(address)) ?? undefined;
    allowLive = !reason;
  }

  const recorder = createRecorder({ request, visitor: hashVisitor(address) });
  const abort = new AbortController();
  let closed = false;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: FoundryEvent) => {
        recorder.observe(e);
        if (!closed) controller.enqueue(encoder.encode(encodeEvent(e)));
      };
      try {
        await runPipeline(request, emit, { allowLive, reason, signal: abort.signal });
      } catch (err) {
        if (!abort.signal.aborted) {
          logRunFailure(err);
          emit({ type: "error", message: visitorMessage(err) });
        }
      } finally {
        await state.runLog.add(recorder.close(abort.signal.aborted));
        if (!closed) {
          closed = true;
          controller.close();
        }
      }
    },
    // The visitor left: stop the agents so a live run stops spending.
    cancel() {
      closed = true;
      abort.abort();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
