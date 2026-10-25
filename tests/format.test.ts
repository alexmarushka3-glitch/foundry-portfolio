import { describe, expect, it } from "vitest";
import { formatAgo, formatClock, formatDuration, formatPercent, formatRunCost, formatTotalCost } from "@/lib/format";

describe("formatDuration", () => {
  it("shows seconds under a minute and minutes above", () => {
    expect(formatDuration(7400)).toBe("7.4s");
    expect(formatDuration(59_900)).toBe("59.9s");
    expect(formatDuration(82_000)).toBe("1m 22s");
  });
});

describe("formatClock", () => {
  it("pads seconds and never goes negative", () => {
    expect(formatClock(65_000)).toBe("1:05");
    expect(formatClock(-500)).toBe("0:00");
  });
});

describe("money and percent", () => {
  it("uses three decimals for one run and two for totals", () => {
    expect(formatRunCost(0.0934)).toBe("$0.093");
    expect(formatTotalCost(1.236)).toBe("$1.24");
  });
  it("rounds percentages", () => {
    expect(formatPercent(0.666)).toBe("67%");
  });
});

describe("formatAgo", () => {
  const now = 1_000_000_000;
  it("steps through seconds, minutes, hours and days", () => {
    expect(formatAgo(now - 3_000, now)).toBe("just now");
    expect(formatAgo(now - 30_000, now)).toBe("30s ago");
    expect(formatAgo(now - 5 * 60_000, now)).toBe("5m ago");
    expect(formatAgo(now - 3 * 3_600_000, now)).toBe("3h ago");
    expect(formatAgo(now - 72 * 3_600_000, now)).toBe("3d ago");
  });
});
