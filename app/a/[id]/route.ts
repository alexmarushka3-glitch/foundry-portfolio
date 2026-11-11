import { withHostedShim } from "@/lib/previewShim";
import { sharedAppHeaders } from "@/lib/securityHeaders";
import { checkSharedApp } from "@/lib/server/shareCheck";
import { SHARE_ID } from "@/lib/server/shareStore";
import { serverState } from "@/lib/server/state";

export const runtime = "nodejs";

// A hosted app link. The page is written by an agent from a visitor's idea, so it is served with the sealed headers
// (lib/securityHeaders.ts sharedAppHeaders): an opaque origin with no cookies, storage or network. The headers are set
// here, on the response itself, because a sandbox that only a <meta> tag asks for does not hold.

const page = (body: string, status: number) =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Foundry app</title></head><body style="font:16px system-ui,sans-serif;padding:24px;max-width:36rem">${body}</body></html>`,
    {
      status,
      headers: {
        ...Object.fromEntries(sharedAppHeaders().map((h) => [h.key, h.value])),
        "Content-Type": "text/html; charset=utf-8",
      },
    },
  );

const gone = () =>
  page(
    "<h1>This link has expired or was never saved</h1><p>Links to apps built on Foundry last 7 days.</p>",
    404,
  );

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!SHARE_ID.test(id)) return gone();
  const state = serverState();
  let html: string | null;
  try {
    html = await state.shares.get(id);
  } catch {
    return page("<h1>This link can't be opened right now</h1><p>Try again in a minute.</p>", 503);
  }
  if (html === null) return gone();
  // The rules run again on every open, so a rule added later also covers links that already exist.
  if (!checkSharedApp(html).ok) {
    await state.shares.remove(id).catch(() => false);
    return gone();
  }
  return new Response(withHostedShim(html), {
    headers: {
      ...Object.fromEntries(sharedAppHeaders().map((h) => [h.key, h.value])),
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}
