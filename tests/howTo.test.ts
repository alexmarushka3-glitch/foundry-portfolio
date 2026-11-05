import { describe, expect, it } from "vitest";
import { howToUse } from "@/lib/howTo";
import type { Step } from "@/lib/run";

const step = (agent: Step["agent"], text: string, round = 1): Step => ({
  agent, round, model: "m", text, start: 0, end: 1, ms: 1,
});

describe("howToUse", () => {
  it("returns the Release agent's bullets without list markers or markdown", () => {
    const text = "Tip Calculator\n\n- Type in the **bill** amount\n* Pick a tip\n1. Read `each` share\nIt saves on your device.";
    expect(howToUse({ steps: [step("pm", "- not this"), step("release", text)] })).toEqual([
      "Type in the bill amount",
      "Pick a tip",
      "Read each share",
    ]);
  });

  it("uses the last release step and caps the list at four", () => {
    const many = Array.from({ length: 6 }, (_, i) => `- step ${i}`).join("\n");
    expect(howToUse({ steps: [step("release", "- old"), step("release", many, 2)] })).toHaveLength(4);
  });

  it("is empty when there is no release note", () => {
    expect(howToUse({ steps: [step("validator", "VERDICT: APPROVE")] })).toEqual([]);
  });
});
