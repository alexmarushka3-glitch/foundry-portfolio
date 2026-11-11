// A short, free rule list that a page must pass before it gets a hosted link, and again each time the link is opened.
// Opening re-runs it so a rule added later also covers links that already exist.
//
// What it is: a guardrail against the obvious ways a page on this site's address could pass for something it is not
// (a login or payment form, a redirect to another site, an embedded outside page). What it is not: a guarantee.
// A determined person can write around any word list. The link page also runs in a sealed sandbox
// (lib/securityHeaders.ts) that gives it no cookies, no storage and no network, but a sandbox cannot stop a page
// from navigating itself, so a page that builds its redirect from pieces can get past the rules below.

export type ShareCheck = { ok: true } | { ok: false; reason: string };

type Rule = { test: (html: string) => boolean; reason: string };

// Whole tags, read with quoted values kept together: a value may contain ">", so a plain [^>]* would stop too early and
// miss what follows it.
const TAG_ATTRS = String.raw`(?:"[^"]*"|'[^']*'|[^>"'])*`;
const tags = (name: string, html: string) =>
  html.match(new RegExp(String.raw`<${name}\b${TAG_ATTRS}>?`, "gi")) ?? [];
const inInputs = (html: string, re: RegExp) => tags("input", html).some((t) => re.test(t));

const RULES: Rule[] = [
  {
    test: (html) =>
      inInputs(
        html,
        /\btype\s*=\s*["']?\s*password|autocomplete\s*=\s*["']?(?:current|new)-password/i,
      ),
    reason: "it asks for a password",
  },
  {
    // A type written with character codes (&#112;assword) is still read by the browser as a password box.
    test: (html) => inInputs(html, /\btype\s*=\s*["']?[^"'\s>]*&/i),
    reason: "it asks for a password",
  },
  {
    // Only inside a form field: a flashcard app may say "card number 3" or have a variable called cardNumber.
    test: (html) =>
      inInputs(
        html,
        /autocomplete\s*=\s*["']?cc-|card[\s_-]?number|\bcvv\b|\bcvc\b|security[\s_-]?code/i,
      ),
    reason: "it asks for card details",
  },
  {
    test: (html) =>
      /verify your (account|identity)|(sign|log)[\s-]?in to (your|continue)|account (has been )?(suspended|locked)|enter your (password|pin|ssn|social security)/i.test(
        html,
      ),
    reason: "it looks like a sign-in or account page",
  },
  {
    test: (html) =>
      tags("form", html).some((t) => /\baction\s*=\s*["']?\s*(?:https?:)?\/\//i.test(t)),
    reason: "it has a form that sends data to another site",
  },
  {
    test: (html) => /<meta\b[^>]*http-equiv\s*=\s*["']?refresh/i.test(html),
    reason: "it redirects to another page",
  },
  {
    // location.href = / .replace( / .assign( (alone, or on window, document, self, top or parent), and location = on its
    // own. A variable or field that happens to be called location (let location = "Kitchen", task.location = x) is fine.
    test: (html) =>
      /\blocation\s*\.\s*(?:href|replace|assign)\s*(?:=(?!=)|\()|\b(?:window|document|self|top|parent)\s*\.\s*location\s*=(?!=)|(?<![.\w$])(?<!\b(?:let|const|var)\s+)location\s*=(?!=)/i.test(
        html,
      ),
    reason: "it sends the visitor to another page",
  },
  {
    test: (html) => /<(iframe|embed|object|base)\b/i.test(html),
    reason: "it embeds another page",
  },
];

export function checkSharedApp(html: string): ShareCheck {
  for (const rule of RULES) {
    if (rule.test(html)) return { ok: false, reason: rule.reason };
  }
  return { ok: true };
}

/** The sentence shown when a page is refused. */
export const refusedMessage = (reason: string) =>
  `This app can't get a link because ${reason}. You can still save it or open it full screen.`;
