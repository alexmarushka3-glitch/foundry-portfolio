import { describe, expect, it } from "vitest";
import {
  MemoryShareBrake,
  RedisShareBrake,
  addressUsedUp,
  createShareBrake,
  dayUsedUp,
} from "@/lib/server/shareBrake";
import {
  MemoryShareStore,
  RedisShareStore,
  SHARE_ID,
  createShareStore,
  newShareId,
} from "@/lib/server/shareStore";
import { SHARE_TTL_SECONDS } from "@/lib/share";
import { fakeUpstash } from "./fixtures/fakeUpstash";

describe("newShareId", () => {
  it("makes 22-character unguessable ids that match the id pattern, and never repeats", () => {
    const ids = new Set(Array.from({ length: 200 }, newShareId));
    expect(ids.size).toBe(200);
    for (const id of ids) expect(id).toMatch(SHARE_ID);
  });
});

describe("MemoryShareStore", () => {
  it("keeps an app until its time is up, then forgets it", async () => {
    let now = 1_000_000;
    const store = new MemoryShareStore(50, () => now);
    await store.put("a", "<h1>A</h1>", 60);
    expect(await store.get("a")).toBe("<h1>A</h1>");
    now += 59_000;
    expect(await store.get("a")).toBe("<h1>A</h1>");
    now += 1_000;
    expect(await store.get("a")).toBeNull();
  });

  it("is not persistent, and says unknown ids are null", async () => {
    const store = new MemoryShareStore();
    expect(store.persistent).toBe(false);
    expect(await store.get("nope")).toBeNull();
  });

  it("drops the oldest app when it is full", async () => {
    const store = new MemoryShareStore(2);
    await store.put("a", "1", 60);
    await store.put("b", "2", 60);
    await store.put("c", "3", 60);
    expect(await store.get("a")).toBeNull();
    expect(await store.get("c")).toBe("3");
  });

  it("removes one app and says whether it was there", async () => {
    const store = new MemoryShareStore();
    await store.put("a", "1", 60);
    expect(await store.remove("a")).toBe(true);
    expect(await store.remove("a")).toBe(false);
    expect(await store.get("a")).toBeNull();
  });
});

describe("RedisShareStore", () => {
  it("saves with an expiry, reads back, and removes", async () => {
    const fake = fakeUpstash();
    const store = new RedisShareStore(fake.config);
    expect(store.persistent).toBe(true);
    await store.put("abc", "<h1>Hi</h1>", SHARE_TTL_SECONDS);
    expect(fake.calls[0].commands[0]).toEqual([
      "SET",
      "foundry:app:abc",
      "<h1>Hi</h1>",
      "EX",
      SHARE_TTL_SECONDS,
    ]);
    expect(await store.get("abc")).toBe("<h1>Hi</h1>");
    expect(await store.get("missing")).toBeNull();
    expect(await store.remove("abc")).toBe(true);
    expect(await store.remove("abc")).toBe(false);
  });

  it("lets a database error through, so the caller can say it could not make a link", async () => {
    const config = {
      url: "https://redis.test",
      token: "t",
      fetchFn: (async () => new Response("no", { status: 500 })) as unknown as typeof fetch,
    };
    await expect(new RedisShareStore(config).put("a", "x", 60)).rejects.toThrow(/500/);
  });
});

describe("createShareStore", () => {
  it("uses Redis when the database variables are set and memory otherwise", () => {
    expect(createShareStore({}).persistent).toBe(false);
    expect(
      createShareStore({ KV_REST_API_URL: "https://r.test", KV_REST_API_TOKEN: "t" }).persistent,
    ).toBe(true);
  });
});

describe("MemoryShareBrake", () => {
  it("allows perHour links per address, refuses after, and other addresses are unaffected", async () => {
    const brake = new MemoryShareBrake({ perHour: 2, perDay: 100 });
    expect(await brake.check("1.1.1.1")).toBeNull();
    expect(await brake.check("1.1.1.1")).toBeNull();
    expect(await brake.check("1.1.1.1")).toBe(addressUsedUp({ perHour: 2, perDay: 100 }));
    expect(await brake.check("2.2.2.2")).toBeNull();
  });

  it("stops everyone when the day total is used up, and a refusal does not count", async () => {
    const brake = new MemoryShareBrake({ perHour: 99, perDay: 2 });
    expect(await brake.check("a")).toBeNull();
    expect(await brake.check("b")).toBeNull();
    expect(await brake.check("c")).toBe(dayUsedUp);
    expect(await brake.check("d")).toBe(dayUsedUp);
  });

  it("frees an address after the hour", async () => {
    let now = 5_000_000;
    const brake = new MemoryShareBrake({ perHour: 1, perDay: 100 }, () => now);
    expect(await brake.check("a")).toBeNull();
    expect(await brake.check("a")).not.toBeNull();
    now += 3_600_001;
    expect(await brake.check("a")).toBeNull();
  });
});

describe("RedisShareBrake", () => {
  const T = Date.UTC(2026, 10, 11, 12);
  const dayKey = (fake: ReturnType<typeof fakeUpstash>) =>
    [...fake.data.keys()].find((k) => k.startsWith("foundry:share:d:"));

  it("counts each limit with its expiry in one transaction, and hashes the address", async () => {
    const fake = fakeUpstash();
    const brake = new RedisShareBrake({ perHour: 2, perDay: 100 }, fake.config, () => T);
    expect(await brake.check("203.0.113.9")).toBeNull();
    expect(fake.calls.map((c) => c.url)).toEqual([
      "https://redis.test/multi-exec",
      "https://redis.test/multi-exec",
    ]);
    expect(fake.calls[0].commands.map(([c]) => c)).toEqual(["INCR", "EXPIRE"]);
    expect(fake.calls[1].commands.map(([c]) => c)).toEqual(["INCR", "EXPIRE"]);
    expect([...fake.data.keys()].join(" ")).not.toContain("203.0.113.9");
    expect(dayKey(fake)).toMatch(/2026-11-11$/);
  });

  it("refuses over the hourly limit without touching the site's day total", async () => {
    const fake = fakeUpstash();
    const brake = new RedisShareBrake({ perHour: 1, perDay: 100 }, fake.config, () => T);
    expect(await brake.check("v")).toBeNull();
    const callsBefore = fake.calls.length;
    for (let i = 0; i < 20; i++)
      expect(await brake.check("v")).toBe(addressUsedUp({ perHour: 1, perDay: 100 }));
    // one Redis call per refusal, and the day total stays at the one link that was made
    expect(fake.calls.length).toBe(callsBefore + 20);
    expect(fake.data.get(dayKey(fake)!)).toBe(1);
    expect(await brake.check("other")).toBeNull();
  });

  it("cannot be used by one address to pause links for everyone", async () => {
    const fake = fakeUpstash();
    const brake = new RedisShareBrake({ perHour: 5, perDay: 40 }, fake.config, () => T);
    for (let i = 0; i < 100; i++) await brake.check("attacker");
    expect(fake.data.get(dayKey(fake)!)).toBe(5);
    expect(await brake.check("someone else")).toBeNull();
  });

  it("refuses everyone once the day total is used", async () => {
    const fake = fakeUpstash();
    const brake = new RedisShareBrake({ perHour: 99, perDay: 1 }, fake.config, () => T);
    expect(await brake.check("a")).toBeNull();
    expect(await brake.check("b")).toBe(dayUsedUp);
  });

  it("gives a slot back when the link could not be saved", async () => {
    const fake = fakeUpstash();
    const brake = new RedisShareBrake({ perHour: 1, perDay: 1 }, fake.config, () => T);
    expect(await brake.check("v")).toBeNull();
    await brake.release("v");
    expect(await brake.check("v")).toBeNull();
  });
});

describe("createShareBrake", () => {
  it("uses Redis when the database variables are set and memory otherwise", () => {
    const limits = { perHour: 1, perDay: 1 };
    expect(createShareBrake(limits, {})).toBeInstanceOf(MemoryShareBrake);
    expect(
      createShareBrake(limits, { KV_REST_API_URL: "https://r.test", KV_REST_API_TOKEN: "t" }),
    ).toBeInstanceOf(RedisShareBrake);
  });
});
