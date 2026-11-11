import { sharedAppHeaders, sharedWrapperHeaders, type Header } from "@/lib/securityHeaders";

// The small pages around a hosted app link: the wrapper that frames it, and the "gone" and "unavailable" notices.
// Every one carries the sealed headers (lib/securityHeaders.ts), so nothing under /a/ is ever served without them.

const headersObject = (headers: Header[]) =>
  Object.fromEntries(headers.map((h) => [h.key, h.value]));

const SHELL = (body: string, style: string) =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Foundry app</title><style>${style}</style></head><body>${body}</body></html>`;

const NOTICE_STYLE = "body{font:16px system-ui,sans-serif;padding:24px;max-width:36rem}";

/** A notice page that is shown inside the frame (or on its own), with the app page's sealed headers. */
export function notice(body: string, status: number): Response {
  return new Response(SHELL(body, NOTICE_STYLE), {
    status,
    headers: { ...headersObject(sharedAppHeaders()), "Content-Type": "text/html; charset=utf-8" },
  });
}

export const gone = () =>
  notice(
    "<h1>This link has expired or was never saved</h1><p>Links to apps built on Foundry last 7 days.</p>",
    404,
  );

export const unavailable = () =>
  notice("<h1>This link can't be opened right now</h1><p>Try again in a minute.</p>", 503);

/** The page a link opens: one full-window frame onto the sealed app page. `id` must already match SHARE_ID. */
export function wrapper(id: string): Response {
  const body = `<iframe src="/a/${id}/app" title="App made on Foundry, running in your browser" sandbox="allow-scripts allow-forms allow-modals" allow="clipboard-write"></iframe>`;
  return new Response(
    SHELL(
      body,
      "html,body{margin:0;height:100%}iframe{display:block;border:0;width:100%;height:100%}",
    ),
    {
      headers: {
        ...headersObject(sharedWrapperHeaders()),
        "Content-Type": "text/html; charset=utf-8",
      },
    },
  );
}

/** The wrapper's own "gone" page (an id that could never be a link). It has no frame, so it needs no frame permission. */
export function wrapperGone(): Response {
  return new Response(
    SHELL(
      "<h1>This link has expired or was never saved</h1><p>Links to apps built on Foundry last 7 days.</p>",
      NOTICE_STYLE,
    ),
    {
      status: 404,
      headers: {
        ...headersObject(sharedWrapperHeaders()),
        "Content-Type": "text/html; charset=utf-8",
      },
    },
  );
}

export const appHeaders = () => headersObject(sharedAppHeaders());
