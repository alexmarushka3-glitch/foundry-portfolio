import { describe, expect, it, vi } from "vitest";
import { FallbackLiveBrake, MemoryLiveBrake, RedisLiveBrake, createLiveBrake, type LiveBrake } from "@/lib/server/liveBrake";
import { LiveLimiter } from "@/lib/server/rateLimit";

/** A tiny fake of the Upstash REST pipeline endpoint: counters plus SCAN, GET and DEL. */
function fakeUpstash() {
  const data = new Map<string, number>();
  const calls: unknown[][][] = [];
  const fetchFn = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    const cmds = JSON.parse(String(init?.body)) as unknown[][];
    calls.push(cmds);
    const out = cmds.map(([cmd, ...args]) => {
      switch (cmd) {
        case "INCR": {
          const n = (data.get(String(args[0])) ?? 0) + 1;
          data.set(String(args[0]), n);
          return { result: n };
        }
        case "DECR": {
          const n = (data.get(String(args[0])) ?? 0) - 1;
          data.set(String(args[0]), n);
          return { result: n };
        }
        case "EXPIRE":
          return { result: 1 };
        case "GET":
          return { result: data.has(String(args[0])) ? String(data.get(String(args[0]))) : null };
        case "SCAN": {
          const re = new RegExp(`^${String(args[2]).replace(/\*/g, ".*")}$`);
          return { result: ["0", [...data.keys()].filter((k) => re.test(k))] };
        }
        case "DEL": {
          for (const k of args) data.delete(String(k));
          return { result: args.length };
        }
        default:
          return { error: `unknown ${String(cmd)}` };
      }
    });
    return new Response(JSON.stringify(out), { status: 200 });
  });
  return { data, calls, config: { url: "https://redis.test", token: "t", fetchFn: fetchFn as unknown as typeof fetch } };
}

describe("RedisLiveBrake", () => {
  const T = Date.UTC(2026, 9, 27, 12);

  it("allows perHour runs per visitor, then refuses with the hourly message", async () => {
    const { config } = fakeUpstash();
    const brake = new RedisLiveBrake({ perHour: 2, perDay: 100 }, config, () => T);
    expect(await brake.check("v")).toBeNull();
    expect(await brake.check("v")).toBeNull();
    expect(await brake.check("v")).toMatch(/2 live runs this hour/);
    expect(await brake.check("other")).toBeNull();
  });

  it("stops everyone at the daily total", async () => {
    const { config } = fakeUpstash();
    const brake = new RedisLiveBrake({ perHour: 99, perDay: 2 }, config, () => T);
    expect(await brake.check("a")).toBeNull();
    expect(await brake.check("b")).toBeNull();
    expect(await brake.check("c")).toMatch(/used up/);
  });

  it("does not count a refused run", async () => {
    const { config } = fakeUpstash();
    const brake = new RedisLiveBrake({ perHour: 1, perDay: 2 }, config, () => T);
    await brake.check("a");
    await brake.check("a"); // refused: hourly
    expect((await brake.snapshot()).usedToday).toBe(1);
    expect(await brake.check("b")).toBeNull();
  });

  it("starts a new count on the next UTC day", async () => {
    const { config } = fakeUpstash();
    let now = T;
    const brake = new RedisLiveBrake({ perHour: 99, perDay: 1 }, config, () => now);
    await brake.check("a");
    expect(await brake.check("b")).toMatch(/used up/);
    now += 86_400_000;
    expect(await brake.check("b")).toBeNull();
  });

  it("never stores the visitor address", async () => {
    const { config, data } = fakeUpstash();
    await new RedisLiveBrake({ perHour: 1, perDay: 5 }, config, () => T).check("203.0.113.9");
    expect([...data.keys()].join(" ")).not.toContain("203.0.113.9");
  });

  it("snapshots usage and the next reset, and resets everything", async () => {
    const { config, data } = fakeUpstash();
    const brake = new RedisLiveBrake({ perHour: 3, perDay: 8 }, config, () => T);
    await brake.check("a");
    await brake.check("b");
    expect(await brake.snapshot()).toMatchObject({
      perHour: 3,
      perDay: 8,
      usedToday: 2,
      visitorsTracked: 2,
      dayResetsAt: Date.UTC(2026, 9, 28),
    });
    await brake.reset();
    expect(data.size).toBe(0);
    expect((await brake.snapshot()).usedToday).toBe(0);
  });
});

describe("FallbackLiveBrake", () => {
  const down: LiveBrake = {
    check: async () => {
      throw new Error("down");
    },
    reset: async () => {
      throw new Error("down");
    },
    snapshot: async () => {
      throw new Error("down");
    },
  };

  it("keeps braking from this instance's counters, and warns, when the database is down", async () => {
    const warn = vi.fn();
    const brake = new FallbackLiveBrake(down, new MemoryLiveBrake(new LiveLimiter({ perHour: 1, perDay: 5 })), warn);
    expect(await brake.check("v")).toBeNull();
    expect(await brake.check("v")).toMatch(/1 live runs this hour/);
    expect((await brake.snapshot()).usedToday).toBe(1);
    await brake.reset();
    expect(warn).toHaveBeenCalled();
  });
});

describe("createLiveBrake", () => {
  const limits = { perHour: 1, perDay: 1 };
  it("uses memory when no database variables are set", () => {
    expect(createLiveBrake(limits, {})).toBeInstanceOf(MemoryLiveBrake);
  });
  it("uses Redis, with the memory fallback, when the Upstash REST variables are set", () => {
    expect(createLiveBrake(limits, { KV_REST_API_URL: "https://a", KV_REST_API_TOKEN: "t" })).toBeInstanceOf(FallbackLiveBrake);
  });
});
