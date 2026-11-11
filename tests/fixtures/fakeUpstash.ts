import { vi } from "vitest";

/**
 * A tiny fake of Upstash's REST endpoints (/pipeline and /multi-exec) with the commands the share store and
 * brake use: SET (with EX), GET, DEL, INCR, DECR and EXPIRE. `calls` lists each request's url and commands.
 */
export function fakeUpstash() {
  const data = new Map<string, string | number>();
  const ttls = new Map<string, number>();
  const calls: { url: string; commands: unknown[][] }[] = [];
  const fetchFn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const commands = JSON.parse(String(init?.body)) as unknown[][];
    calls.push({ url: String(url), commands });
    const out = commands.map(([cmd, ...args]) => {
      const key = String(args[0]);
      switch (cmd) {
        case "SET": {
          data.set(key, String(args[1]));
          if (args[2] === "EX") ttls.set(key, Number(args[3]));
          return { result: "OK" };
        }
        case "GET":
          return { result: data.has(key) ? data.get(key) : null };
        case "DEL": {
          const had = data.delete(key);
          ttls.delete(key);
          return { result: had ? 1 : 0 };
        }
        case "INCR":
        case "DECR": {
          const n = Number(data.get(key) ?? 0) + (cmd === "INCR" ? 1 : -1);
          data.set(key, n);
          return { result: n };
        }
        case "EXPIRE": {
          if (!ttls.has(key)) ttls.set(key, Number(args[1]));
          return { result: 1 };
        }
        default:
          return { error: `unknown ${String(cmd)}` };
      }
    });
    return new Response(JSON.stringify(out), { status: 200 });
  });
  return {
    data,
    ttls,
    calls,
    fetchFn,
    config: { url: "https://redis.test", token: "t", fetchFn: fetchFn as unknown as typeof fetch },
  };
}
