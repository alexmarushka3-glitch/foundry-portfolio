// A short, free rule list that a page must pass before it gets a hosted link, and again each time the link is opened.
// Opening re-runs it so a rule added later also covers links that already exist.
//
// What it is: a guardrail against the obvious ways a page on this site's address could pass for something it is not
// (a login or payment form, a redirect to another site, an embedded outside page). What it is not: a guarantee.
// A determined person can write around any word list, so the link page also runs in a sealed sandbox
// (lib/securityHeaders.ts) that gives it no cookies, no storage and no network.

export type ShareCheck = { ok: true } | { ok: false; reason: string };

type Rule = { test: RegExp; reason: string };

const RULES: Rule[] = [
  {
    test: /<input\b[^>]*\btype\s*=\s*["']?password\b|autocomplete\s*=\s*["']?(current|new)-password/i,
    reason: "it asks for a password",
  },
  {
    test: /autocomplete\s*=\s*["']?cc-|\b(card[\s_-]?number|cvv|cvc|security[\s_-]?code)\b/i,
    reason: "it asks for card details",
  },
  {
    test: /verify your (account|identity)|(sign|log)[\s-]?in to (your|continue)|account (has been )?(suspended|locked)|enter your (password|pin|ssn|social security)/i,
    reason: "it looks like a sign-in or account page",
  },
  {
    test: /<form\b[^>]*\baction\s*=\s*["']?\s*(https?:)?\/\//i,
    reason: "it has a form that sends data to another site",
  },
  {
    test: /<meta\b[^>]*http-equiv\s*=\s*["']?refresh/i,
    reason: "it redirects to another page",
  },
  {
    test: /\b(window\.|top\.|parent\.|self\.)?location\s*(\.\s*(href|replace|assign)\s*(=(?!=)|\()|=(?!=))/i,
    reason: "it sends the visitor to another page",
  },
  {
    test: /<(iframe|embed|object|base)\b/i,
    reason: "it embeds another page",
  },
];

export function checkSharedApp(html: string): ShareCheck {
  for (const rule of RULES) {
    if (rule.test.test(html)) return { ok: false, reason: rule.reason };
  }
  return { ok: true };
}

/** The sentence shown when a page is refused. */
export const refusedMessage = (reason: string) =>
  `This app can't get a link because ${reason}. You can still save it or open it full screen.`;
