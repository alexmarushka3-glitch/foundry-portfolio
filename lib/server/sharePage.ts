import { sharedAppHeaders, sharedWrapperHeaders, type Header } from "@/lib/securityHeaders";
import { SHARE_IDLE_DAYS, SHARE_MAX_DAYS } from "@/lib/share";

// The small pages around a hosted app link: the wrapper that frames it, and the "gone" and "unavailable" notices.
// Each carries the sealed headers (lib/securityHeaders.ts): the wrapper pages the wrapper's, the rest the app page's.
// A well-formed id always gets the wrapper with a 200, even for an expired link; the notice shows inside its frame.

const page = (headers: Header[], head: string, body: string, status = 200, extraHead = "") =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Foundry web app</title>${extraHead}<style>${head}</style></head><body>${body}</body></html>`,
    {
      status,
      headers: {
        ...Object.fromEntries(headers.map((h) => [h.key, h.value])),
        "Content-Type": "text/html; charset=utf-8",
      },
    },
  );

const NOTICE_STYLE = "body{font:16px system-ui,sans-serif;padding:24px;max-width:36rem}";
const GONE_BODY = `<h1>This link has expired or was never saved</h1><p>A link to a web app built on Foundry lasts ${SHARE_IDLE_DAYS} days after it was last opened, and ${SHARE_MAX_DAYS} days at most. Data it saved stays on your device.</p>`;
const UNAVAILABLE_BODY =
  "<h1>This link can't be opened right now</h1><p>Try again in a minute.</p>";

/** Notices shown inside the frame, with the app page's sealed headers. */
export const gone = () => page(sharedAppHeaders(), NOTICE_STYLE, GONE_BODY, 404);
const OFF_BODY =
  "<h1>Web app links are switched off for now</h1><p>Ask the person who sent this link to share it another way.</p>";

/** The wrapper's own "switched off" page: no frame at all. */
export const wrapperOff = () => page(sharedWrapperHeaders(), NOTICE_STYLE, OFF_BODY, 503);

export const off = () =>
  page(
    sharedAppHeaders(),
    NOTICE_STYLE,
    "<h1>Web app links are switched off for now</h1><p>Ask the person who sent this link to share it another way.</p>",
    503,
  );
export const unavailable = () => page(sharedAppHeaders(), NOTICE_STYLE, UNAVAILABLE_BODY, 503);

/**
 * The page a link opens: one full-window frame onto the sealed app page, the site's bridge script that keeps the app's
 * data on this device, and what a phone or computer needs to add the link to its home screen as an app (a manifest, an
 * icon, and the iOS tags). `id` must already match SHARE_ID.
 */
export const wrapper = (id: string) =>
  page(
    sharedWrapperHeaders(),
    "html,body{margin:0;height:100%;background:#1e252b}iframe{display:block;border:0;width:100%;height:100%}",
    `<script src="/app-bridge.js"></script><script src="/app-install.js"></script><iframe src="/a/${id}/app" title="Web app made on Foundry, running in your browser" sandbox="allow-scripts allow-forms allow-modals" allow="clipboard-write *"></iframe>`,
    200,
    `<link rel="manifest" href="/a/${id}/manifest.webmanifest"><link rel="apple-touch-icon" href="/pwa-icon/180"><meta name="theme-color" content="#1e252b"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-capable" content="yes">`,
  );

/** For a path that could never be a link. It has no frame, so it needs no frame permission. */
export const wrapperGone = () => page(sharedWrapperHeaders(), NOTICE_STYLE, GONE_BODY, 404);

export const appHeaders = () => Object.fromEntries(sharedAppHeaders().map((h) => [h.key, h.value]));
