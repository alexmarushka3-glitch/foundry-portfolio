// The visitor's idea for an app: one short sentence in their own words. It is checked here (browser and server), and
// the agents are told it is data, not instructions. Browser and server safe.

export const IDEA_MIN = 8;
export const IDEA_MAX = 160;

/** Ideas Foundry turns down before any agent runs: apps that collect logins or payment details. */
const BLOCKED =
  /\b(password|passcode|log ?in page|sign ?in page|credit card|card number|cvv|bank (login|account)|social security|ssn|phishing)\b/i;

export function cleanIdea(raw: unknown): string {
  return typeof raw === "string"
    ? raw
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    : "";
}

export type IdeaResult = { ok: true; idea: string } | { ok: false; error: string };

export function validateIdea(raw: unknown): IdeaResult {
  const idea = cleanIdea(raw);
  if (idea.length < IDEA_MIN) return { ok: false, error: "Describe the app in a few words first." };
  if (idea.length > IDEA_MAX) return { ok: false, error: `Keep it under ${IDEA_MAX} characters.` };
  if (!/[a-z]{3}/i.test(idea)) return { ok: false, error: "Describe the app in words." };
  if (BLOCKED.test(idea))
    return {
      ok: false,
      error: "Foundry doesn't build apps that ask for logins or payment details. Try another idea.",
    };
  return { ok: true, idea };
}
