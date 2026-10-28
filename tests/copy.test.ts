import { describe, expect, it } from "vitest";
import { profile } from "@/lib/profile";
import { REALITY } from "@/lib/reality";

// The site's honesty rules (CLAUDE.md), enforced on the page copy so a rewrite can't quietly break them.

const allCopy = () =>
  [profile.headline, profile.tagline, profile.intro, profile.how, profile.pitch, ...profile.about, ...profile.projects.flatMap((p) => [p.name, p.blurb]), ...REALITY.flatMap((c) => c.items)].join("\n");

describe("page copy", () => {
  it("never calls the output a reviewed pull request, or says anything passed review", () => {
    const copy = allCopy();
    expect(copy).not.toMatch(/reviewed pull request/i);
    expect(copy).not.toMatch(/passed (code )?review/i);
  });

  it("describes the output as a pull request draft checked by other agents", () => {
    expect(profile.intro).toMatch(/draft pull request/i);
    expect(profile.intro).toMatch(/checked by other agents/i);
    expect(profile.pitch).toMatch(/draft pull request/i);
  });

  it("says the work happens on a small sample app, in the intro", () => {
    expect(profile.intro).toMatch(/small task-tracker app/i);
  });

  it("keeps the caveats about unrun code and the agent-only E2E check in Scope and limits", () => {
    const notDone = REALITY.find((c) => c.tone === "limits")!.items.join(" ");
    expect(notDone).toMatch(/simulation never runs any code/i);
    expect(REALITY.find((c) => c.tone === "working")!.items.join(" ")).toMatch(/sandbox/i);
    expect(notDone).toMatch(/does not drive a browser/i);
    expect(notDone).toMatch(/no human reviews/i);
  });

  it("describes the replays as real live runs, not the older text-only version", () => {
    const copy = allCopy();
    const working = REALITY.find((c) => c.tone === "working")!.items.join(" ");
    expect(copy).not.toMatch(/earlier version/i);
    expect(copy).not.toMatch(/older text-only/i);
    expect(working).toMatch(/real live runs/i);
    expect(working).toMatch(/faster than they ran/i);
    expect(working).toMatch(/recorded once/i);
    expect(profile.pitch).not.toMatch(/earlier version/i);
  });

  it("says the recordings opened no pull request and no human reviewed anything", () => {
    const limits = REALITY.find((c) => c.tone === "limits")!.items.join(" ");
    expect(limits).toMatch(/recordings and the simulation open none/i);
    expect(limits).toMatch(/demo, not a success rate/i);
    expect(limits).toMatch(/none of the three recordings includes a send-back/i);
    expect(limits).not.toMatch(/recordings and the simulation never run any code/i);
  });

  it("describes the hand check of three drafts as a spot check, not a review, and names its one finding", () => {
    const limits = REALITY.find((c) => c.tone === "limits")!.items.join(" ");
    expect(limits).toMatch(/three of the eight draft pull requests/i);
    expect(limits).toMatch(/spot check, not a review/i);
    expect(limits).toMatch(/browser test that is not in the pull request/i);
    expect(limits).toMatch(/no human reviews the pull requests/i);
    expect(limits).not.toMatch(/reviewed pull request|passed review/i);
  });

  it("labels the sample dashboard as made up", () => {
    const simulated = REALITY.find((c) => c.tone === "simulated")!.items.join(" ");
    expect(simulated).toMatch(/dashboard/i);
    expect(simulated).toMatch(/made up/i);
  });

  it("gives the site a short title and a site address", () => {
    expect(profile.headline).toBe("Foundry");
    expect(profile.siteUrl).toMatch(/^https:\/\//);
  });
});
