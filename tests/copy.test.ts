import { describe, expect, it } from "vitest";
import { profile } from "@/lib/profile";
import { REALITY } from "@/lib/reality";

// The site's honesty rules (CLAUDE.md), enforced on the page copy so a rewrite can't quietly break them.

const allCopy = () =>
  [profile.headline, profile.intro, profile.pitch, ...profile.about, ...profile.projects.flatMap((p) => [p.name, p.blurb]), ...REALITY.flatMap((c) => c.items)].join("\n");

describe("page copy", () => {
  it("never calls the output a reviewed pull request, or says anything passed review", () => {
    const copy = allCopy();
    expect(copy).not.toMatch(/reviewed pull request/i);
    expect(copy).not.toMatch(/passed (code )?review/i);
  });

  it("describes the output as a pull request draft checked by other agents", () => {
    expect(profile.intro).toMatch(/pull request draft/i);
    expect(profile.intro).toMatch(/checked by other agents/i);
    expect(profile.pitch).toMatch(/pull request draft/i);
  });

  it("says the work happens on a small sample app, in the intro", () => {
    expect(profile.intro).toMatch(/small task-tracker app/i);
  });

  it("keeps the caveats about unrun code and the agent-only E2E check in What's real", () => {
    const notDone = REALITY.find((c) => c.heading === "Not done yet")!.items.join(" ");
    expect(notDone).toMatch(/never run/i);
    expect(notDone).toMatch(/does not drive a browser/i);
    expect(notDone).toMatch(/no human reviews/i);
  });

  it("labels the sample dashboard as made up", () => {
    const simulated = REALITY.find((c) => c.heading === "Simulated")!.items.join(" ");
    expect(simulated).toMatch(/dashboard/i);
    expect(simulated).toMatch(/made up/i);
  });

  it("gives the site a short title and a site address", () => {
    expect(profile.headline).toBe("Foundry");
    expect(profile.siteUrl).toMatch(/^https:\/\//);
  });
});
