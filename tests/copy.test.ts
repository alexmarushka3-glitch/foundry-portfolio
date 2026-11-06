import { describe, expect, it } from "vitest";
import { profile } from "@/lib/profile";
import { REALITY } from "@/lib/reality";
import liveRecordings from "@/lib/liveRecordings.json";

// The site's honesty rules (CLAUDE.md), enforced on the page copy so a rewrite can't quietly break them.

const allCopy = () =>
  [
    profile.headline,
    profile.tagline,
    profile.intro,
    profile.how,
    profile.pitch,
    ...profile.about,
    ...profile.lessons.flatMap((l) => [l.title, l.body]),
    ...profile.caseStudy.flatMap((r) => [r.term, r.text]),
    ...REALITY.flatMap((c) => [c.heading, ...c.items, ...c.short]),
  ].join("\n");
const column = (tone: string) => REALITY.find((c) => c.tone === tone)!.items.join(" ");

describe("page copy", () => {
  it("never says the apps were reviewed, or claims a success rate or reliability", () => {
    const copy = allCopy();
    expect(copy).not.toMatch(/\breviewed\b|passed (code )?review/i);
    expect(copy).not.toMatch(/(?<!not a )success rate/i);
    expect(copy).not.toMatch(/\breliabl/i);
  });

  it("says plainly what visitors get: an app they can use on the page and save", () => {
    expect(profile.tagline).toMatch(/build it, test it/i);
    expect(profile.intro).toMatch(/use the app/i);
    expect(profile.intro).toMatch(/save it as one file/i);
  });

  it("keeps the caveats: real tests in a sandbox, no human review, small one-page apps, a demo not a success rate", () => {
    expect(column("working")).toMatch(/sandbox/i);
    expect(column("working")).toMatch(/real headless Chrome/i);
    const limits = column("limits");
    expect(limits).toMatch(/no human reviews/i);
    expect(limits).toMatch(/one page/i);
    expect(limits).toMatch(/demo, not a success rate/i);
  });

  it("describes the examples as recordings of real live runs, kept as they came out", () => {
    expect(column("working")).toMatch(/recordings of real live runs/i);
    expect(column("working")).toMatch(/kept as they came out/i);
  });

  it("says the simulation runs no model and builds no app", () => {
    expect(column("simulated")).toMatch(/no model runs and no app is built/i);
  });

  it("keeps every short line in step with its full line", () => {
    for (const c of REALITY) expect(c.short).toHaveLength(c.items.length);
  });

  it("stays short: the intro is two sentences at most", () => {
    expect(profile.intro.split(/[.!?](\s|$)/).filter((s) => s.trim().length > 1).length).toBeLessThanOrEqual(2);
  });

  it("gives the site a short title and a site address", () => {
    expect(profile.headline).toBe("Foundry");
    expect(profile.siteUrl).toMatch(/^https:\/\//);
  });

  it("gives recruiters a case study whose numbers match the shipped recordings", () => {
    const recs = (liveRecordings as { recordings: { totalMs: number; costUsd: number; approved: boolean; rounds: number }[] }).recordings;
    const secs = recs.map((r) => Math.round(r.totalMs / 1000));
    const cents = recs.map((r) => Math.round(r.costUsd * 100));
    const happened = profile.caseStudy.find((r) => r.term === "What happened")!.text;
    expect(happened).toContain(`The ${recs.length} recorded examples`);
    expect(happened).toContain(`${Math.min(...secs)} to ${Math.max(...secs)} seconds`);
    expect(happened).toContain(`${Math.min(...cents)} to ${Math.max(...cents)} cents`);
    expect(recs.every((r) => r.approved && r.rounds === 1)).toBe(true); // "passed both checks on the first round"
    expect(happened).toMatch(/demo, not a success rate/);
  });
});
