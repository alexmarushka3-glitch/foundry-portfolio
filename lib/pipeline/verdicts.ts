// How the pipeline reads its two gates. Each agent is told to put its verdict on the first line.
// We take the FIRST verdict marker in the text, so a later mention (for example "the earlier FAIL is now a PASS")
// can't flip the result, and a short preamble before the marker is tolerated.

const firstWord = (text: string, pattern: RegExp): string | undefined => pattern.exec(text)?.[1]?.toUpperCase();

/** True when the E2E Verifier's first verdict marker says PASS. No marker counts as a fail. */
export const e2ePassed = (text: string): boolean => firstWord(text, /E2E:\s*(PASS|FAIL)\b/i) === "PASS";

/** True when the Validator's first verdict marker says APPROVE. No marker counts as not approved. */
export const validatorApproved = (text: string): boolean => firstWord(text, /VERDICT:\s*(APPROVE|REVISE)\b/i) === "APPROVE";
