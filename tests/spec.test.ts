import { describe, expect, it } from "vitest";
import { IDEA_MAX, cleanIdea, validateIdea } from "@/lib/spec";

describe("validateIdea", () => {
  it("accepts a plain idea and tidies spaces and control characters", () => {
    expect(validateIdea("  A tip calculator\u0000 that   splits the bill\n")).toEqual({
      ok: true,
      idea: "A tip calculator that splits the bill",
    });
  });

  it("asks for a few words when the idea is missing, too short or not words", () => {
    for (const raw of [undefined, null, 42, "", "   ", "app", "12345678 9"])
      expect(validateIdea(raw).ok).toBe(false);
  });

  it("refuses ideas over the length limit", () => {
    const r = validateIdea("a".repeat(IDEA_MAX + 1));
    expect(r.ok).toBe(false);
  });

  it("turns down apps that collect logins or payment details before any agent runs", () => {
    for (const raw of [
      "A login page that saves passwords",
      "A form for credit card numbers",
      "Store my bank login",
    ]) {
      const r = validateIdea(raw);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/logins or payment/);
    }
  });

  it("returns an empty string for non-strings", () => {
    expect(cleanIdea({})).toBe("");
  });
});
