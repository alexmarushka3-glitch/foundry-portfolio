import { encodeEvent } from "@/lib/ndjson";
import { liveEnabled, runPipeline } from "@/lib/pipeline";
import { findServerRecording } from "@/lib/server/liveRecordings";
import { createRecorder, hashVisitor } from "@/lib/server/runLog";
import {
  browserId,
  logRunFailure,
  parseRequest,
  readJsonBody,
  visitorAddress,
  visitorMessage,
} from "@/lib/server/runApi";
import { shareEnabled } from "@/lib/server/env";
import { prepareWithin } from "@/lib/server/shareSigner";
import { serverState } from "@/lib/server/state";
import type { FoundryEvent } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300; // a live run takes about 1 to 2 minutes; a second round adds about as much

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
  const browser = browserId(req.headers);

  // Recorded examples never cost anything, so only other requests count against the limits.
  let allowLive = true;
  let reason: string | undefined;
  if (liveEnabled() && !findServerRecording(request)) {
    reason = (await state.liveLimiter.check(address, browser.id)) ?? undefined;
    allowLive = !reason;
  }

  // When links are on, a live run's finished app is signed so the link endpoint can tell it came from a real run.
  // Recorded examples and simulations need no signature (a recording is matched by its content), and the key is only
  // waited for briefly: a slow database means this run just has no link.
  const signing =
    allowLive &&
    liveEnabled() &&
    !findServerRecording(request) &&
    shareEnabled() &&
    state.shares.persistent &&
    (await prepareWithin(state.shareSigner, 1500));
  const recorder = createRecorder({ request, visitor: hashVisitor(address) });
  const abort = new AbortController();
  let closed = false;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: FoundryEvent) => {
        recorder.observe(e);
        if (closed) return;
        let out = e;
        if (e.type === "files" && signing) {
          const sig = state.shareSigner.sign(e.files);
          if (sig) out = { ...e, sig };
        }
        controller.enqueue(encoder.encode(encodeEvent(out)));
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
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      ...(browser.setCookie ? { "Set-Cookie": browser.setCookie } : {}),
    },
  });
}
