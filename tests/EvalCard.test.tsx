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

  it("says 1 was sent back, and 2 were, so the sentence reads correctly", () => {
    const { container, rerender } = render(<EvalCard runs={[run({ rounds: 2 }), run()]} />);
    expect(container.textContent).toMatch(/1 was sent back/);
    rerender(<EvalCard runs={[run({ rounds: 2 }), run({ rounds: 2 })]} />);
    expect(container.textContent).toMatch(/2 were sent back/);
  });

  it("reports average cost and time over every run, including the ones not approved", () => {
    render(<EvalCard runs={[run({ costUsd: 0.1, ms: 40_000 }), run({ approved: false, costUsd: 0.3, ms: 80_000 })]} />);
    expect(screen.getByText(/\$0\.20/)).toBeTruthy();
    expect(screen.getByText(/60 s/)).toBeTruthy();
  });

  it("breaks the outcomes down so the not approved and sent back runs are visible", () => {
    const { container } = render(
      <EvalCard runs={[run(), run({ rounds: 2, request: "Add a filter" }), run({ approved: false, request: "Add a sort" })]} />,
    );
    const text = container.textContent ?? "";
    expect(text).toMatch(/1 approved on the first round/);
    expect(text).toMatch(/1 approved after a second round/);
    expect(text).toMatch(/1 not approved/);
  });

  it("lists each run that was not approved on the first round, with its request", () => {
    render(<EvalCard runs={[run(), run({ rounds: 2, request: "Add a filter" }), run({ approved: false, request: "Add a sort" })]} />);
    expect(screen.getByText(/Add a filter/)).toBeTruthy();
    expect(screen.getByText(/Add a sort/)).toBeTruthy();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("says runs that did not finish are not counted", () => {
    const { container } = render(<EvalCard runs={[run()]} />);
    expect(container.textContent).toMatch(/did not finish.*not counted/i);
  });
});
