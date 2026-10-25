import { describe, expect, it } from "vitest";
import { e2ePassed, validatorApproved } from "@/lib/pipeline/verdicts";

describe("e2ePassed", () => {
  it("reads the first verdict line", () => {
    expect(e2ePassed("E2E: PASS\nFlow 1: PASS")).toBe(true);
    expect(e2ePassed("E2E: FAIL\nFlow 1: PASS")).toBe(false);
  });
  it("tolerates markdown and a short preamble", () => {
    expect(e2ePassed("**E2E: PASS**")).toBe(true);
    expect(e2ePassed("Here is my verdict.\nE2E: pass")).toBe(true);
  });
  it("is not flipped by a later mention", () => {
    expect(e2ePassed("E2E: FAIL\nOnce fixed this would read E2E: PASS")).toBe(false);
  });
  it("treats a missing verdict as a fail", () => {
    expect(e2ePassed("Flow 1: PASS")).toBe(false);
    expect(e2ePassed("")).toBe(false);
  });
});

describe("validatorApproved", () => {
  it("reads APPROVE and REVISE", () => {
    expect(validatorApproved("VERDICT: APPROVE\n- fine")).toBe(true);
    expect(validatorApproved("VERDICT: REVISE\n- cannot APPROVE yet")).toBe(false);
  });
  it("treats a missing verdict as not approved", () => {
    expect(validatorApproved("Looks good to me")).toBe(false);
  });
});
