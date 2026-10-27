import { describe, expect, it, vi } from "vitest";
import type { RunRecord } from "@/lib/server/runLog";
import { FallbackRunStore, MemoryRunStore, RedisRunStore, createRunStore, type RunStore } from "@/lib/server/runStore";

const record = (over: Partial<RunRecord> = {}): RunRecord => ({
  id: crypto.randomUUID(),
  at: 0,
  request: "idea",
  mode: "simulated",
  status: "approved",
  ms: 1000,
  rounds: 1,
  costUsd: 0,
  inputTokens: 0,
  outputTokens: 0,
  agentMs: {},
  visitor: "abc",
  ...over,
});

/** A tiny fake of the Upstash REST pipeline endpoint: one Redis list. */
function fakeUpstash() {
  let list: string[] = [];
  const calls: unknown[][][] = [];
  const fetchFn = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    const cmds = JSON.parse(String(init?.body)) as unknown[][];
    calls.push(cmds);
    const out = cmds.map(([cmd, , ...args]) => {
      switch (cmd) {
        case "LPUSH":
          list.unshift(String(args[0]));
          return { result: list.length };
        case "LTRIM":
          list = list.slice(Number(args[0]), Number(args[1]) + 1);
          return { result: "OK" };
        case "LRANGE":
          return { result: [...list] };
        case "LLEN":
          return { result: list.length };
        case "DEL": {
          const n = list.length ? 1 : 0;
          list = [];
          return { result: n };
        }
        default:
          return { error: `unknown ${String(cmd)}` };
      }
    });
    return new Response(JSON.stringify(out), { status: 200 });
  });
  return { fetchFn: fetchFn as unknown as typeof fetch, calls };
}

describe("MemoryRunStore", () => {
  it("lists newest first, trims to capacity and clears", async () => {
    const store = new MemoryRunStore(2);
    for (const at of [1, 2, 3]) await store.add(record({ at }));
    expect((await store.list()).map((r) => r.at)).toEqual([3, 2]);
    expect(await store.clear()).toBe(2);
    expect(await store.list()).toEqual([]);
  });
});

describe("RedisRunStore", () => {
  const make = (capacity = 3) => {
    const fake = fakeUpstash();
    const store = new RedisRunStore({ url: "https://redis.test", token: "t", capacity, fetchFn: fake.fetchFn });
    return { store, ...fake };
  };

  it("lists newest first and keeps only the newest `capacity` records", async () => {
    const { store } = make(3);
    for (const at of [1, 2, 3, 4]) await store.add(record({ at }));
    expect((await store.list()).map((r) => r.at)).toEqual([4, 3, 2]);
  });

  it("clears and says how many it dropped", async () => {
    const { store } = make();
    await store.add(record());
    await store.add(record());
    expect(await store.clear()).toBe(2);
    expect(await store.list()).toEqual([]);
  });

  it("sends the token as a bearer header and never puts it in the URL", async () => {
    const { store, fetchFn } = (() => {
      const fake = fakeUpstash();
      return { store: new RedisRunStore({ url: "https://redis.test", token: "secret-t", fetchFn: fake.fetchFn }), fetchFn: fake.fetchFn };
    })();
    await store.add(record());
    const [url, init] = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toBe("https://redis.test/pipeline");
    expect(String(url)).not.toContain("secret-t");
    expect((init as RequestInit).headers).toMatchObject({ Authorization: "Bearer secret-t" });
  });

  it("throws on a failed request so the caller can fall back", async () => {
    const store = new RedisRunStore({
      url: "https://redis.test",
      token: "t",
      fetchFn: (async () => new Response("no", { status: 500 })) as unknown as typeof fetch,
    });
    await expect(store.list()).rejects.toThrow();
  });
});

describe("FallbackRunStore", () => {
  const down: RunStore = {
    capacity: 5,
    persistent: true,
    add: async () => {
      throw new Error("down");
    },
    list: async () => {
      throw new Error("down");
    },
    clear: async () => {
      throw new Error("down");
    },
  };

  it("keeps working from memory, and warns, when the database is down", async () => {
    const warn = vi.fn();
    const store = new FallbackRunStore(down, warn);
    await store.add(record({ at: 1 }));
    await store.add(record({ at: 2 }));
    expect((await store.list()).map((r) => r.at)).toEqual([2, 1]);
    expect(await store.clear()).toBe(2);
    expect(warn).toHaveBeenCalled();
  });

  it("reads from the database when it works", async () => {
    const fake = fakeUpstash();
    const redis = new RedisRunStore({ url: "https://redis.test", token: "t", fetchFn: fake.fetchFn });
    const store = new FallbackRunStore(redis, vi.fn());
    await store.add(record({ at: 7 }));
    expect((await store.list()).map((r) => r.at)).toEqual([7]);
  });
});

describe("createRunStore", () => {
  it("uses memory when no database variables are set", () => {
    expect(createRunStore({})).toBeInstanceOf(MemoryRunStore);
  });
  it("uses Redis when the Upstash REST variables are set (either naming)", () => {
    expect(createRunStore({ KV_REST_API_URL: "https://a", KV_REST_API_TOKEN: "t" })).toBeInstanceOf(RedisRunStore);
    expect(createRunStore({ UPSTASH_REDIS_REST_URL: "https://a", UPSTASH_REDIS_REST_TOKEN: "t" })).toBeInstanceOf(RedisRunStore);
  });
});
