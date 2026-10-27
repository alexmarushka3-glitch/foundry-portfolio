// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import EvalCard from "@/components/EvalCard";
import type { EvalRun } from "@/lib/eval/summarize";

afterEach(cleanup);

const run = (over: Partial<EvalRun> = {}): EvalRun => ({ approved: true, rounds: 1, costUsd: 0.2, ms: 60_000, ...over });

describe("EvalCard", () => {
  it("renders nothing until there are real runs, so no empty or invented number shows", () => {
    const { container } = render(<EvalCard runs={[]} />);
    expect(container.innerHTML).toBe("");
  });

  it("states how many live runs were approved out of how many", () => {
    render(<EvalCard runs={[run(), run(), run({ approved: false, rounds: 2 })]} />);
    expect(screen.getByText(/2 of 3 live runs/)).toBeTruthy();
  });

  it("shows the interval and says a small batch is not a success rate", () => {
    render(<EvalCard runs={[run(), run(), run()]} />);
    expect(screen.getByText(/could be anywhere from \d+% to \d+%/)).toBeTruthy();
    expect(screen.getByText(/not a success rate/i)).toBeTruthy();
  });

  it("says no human reviewed the runs and never uses the banned review wording", () => {
    const { container } = render(<EvalCard runs={[run()]} />);
    const text = container.textContent ?? "";
    expect(text).toMatch(/no human/i);
    expect(text).not.toMatch(/reviewed pull request|passed review/i);
  });

  it("reports average cost and time over every run, including the ones not approved", () => {
    render(<EvalCard runs={[run({ costUsd: 0.1, ms: 40_000 }), run({ approved: false, costUsd: 0.3, ms: 80_000 })]} />);
    expect(screen.getByText(/\$0\.20/)).toBeTruthy();
    expect(screen.getByText(/60 s/)).toBeTruthy();
  });
});
