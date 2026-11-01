import { describe, expect, it } from "vitest";
import { EVAL_REQUESTS, MAX_EVAL_RUNS, UPPER_COST_PER_RUN_USD, planBatch } from "@/lib/eval/plan";
import { validateIdea } from "@/lib/spec";

describe("planBatch", () => {
  it("cycles through the fixed requests so every kind of change is tried", () => {
    const plan = planBatch(EVAL_REQUESTS.length * 2);
    expect(plan.requests).toHaveLength(EVAL_REQUESTS.length * 2);
    expect(plan.requests.slice(0, EVAL_REQUESTS.length)).toEqual(EVAL_REQUESTS);
    expect(plan.requests.slice(EVAL_REQUESTS.length)).toEqual(EVAL_REQUESTS);
  });

  it("states the most the batch can cost, so the cost is shown before anything runs", () => {
    expect(planBatch(10).maxCostUsd).toBeCloseTo(10 * UPPER_COST_PER_RUN_USD, 5);
  });

  it("refuses a batch bigger than the cap", () => {
    expect(() => planBatch(MAX_EVAL_RUNS + 1)).toThrow(/at most/);
  });

  it.each([0, -1, 1.5, Number.NaN])("refuses %s runs", (n) => {
    expect(() => planBatch(n)).toThrow(/whole number/);
  });

  it("uses only ideas a visitor could type, so the test matches what visitors can do", () => {
    for (const r of EVAL_REQUESTS) expect(validateIdea(r)).toEqual({ ok: true, idea: r });
  });
});
