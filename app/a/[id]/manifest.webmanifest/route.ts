import { appTitle } from "@/lib/bundle";
import { shareEnabled } from "@/lib/server/env";
import { SHARE_ID } from "@/lib/server/shareStore";
import { serverState } from "@/lib/server/state";

export const runtime = "nodejs";

// The web app manifest of a hosted link: what a browser needs to add the link to a home screen or install it, so it
// opens like an app (its own window, no address bar) instead of a tab. It names the app after its own title. It never
// starts the link's idle clock again (that is for opening the app, not for looking at its name).

const HEADERS = {
  "Content-Type": "application/manifest+json; charset=utf-8",
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer",
};

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!SHARE_ID.test(id) || !shareEnabled())
    return new Response(null, { status: 404, headers: HEADERS });
  let html: string | null;
  try {
    html = await serverState().shares.peek(id);
  } catch {
    return new Response(null, { status: 503, headers: HEADERS });
  }
  if (html === null) return new Response(null, { status: 404, headers: HEADERS });
  const name = appTitle(html).slice(0, 45);
  const manifest = {
    id: `/a/${id}`,
    name,
    short_name: name.slice(0, 12),
    description:
      "A web app made on Foundry. It runs in your browser and keeps its data on this device.",
    start_url: `/a/${id}`,
    scope: `/a/${id}`,
    display: "standalone",
    background_color: "#1e252b",
    theme_color: "#1e252b",
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png" },
    ],
  };
  return new Response(JSON.stringify(manifest), { headers: HEADERS });
}
