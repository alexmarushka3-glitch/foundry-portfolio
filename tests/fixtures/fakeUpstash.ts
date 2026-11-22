import { vi } from "vitest";

/**
 * A tiny fake of Upstash's REST endpoints (/pipeline and /multi-exec) with the commands the share store and
 * brake use: SET (with EX, any order of NX and EX), GET, GETEX, DEL, INCR, DECR and EXPIRE (which replaces the lifetime). `calls` lists each request's url and commands.
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
          const options = args.slice(2).map(String);
          if (options.includes("NX") && data.has(key)) return { result: null };
          data.set(key, String(args[1]));
          const ex = options.indexOf("EX");
          if (ex >= 0) ttls.set(key, Number(options[ex + 1]));
          return { result: "OK" };
        }
        case "GET":
          return { result: data.has(key) ? data.get(key) : null };
        case "GETEX": {
          if (!data.has(key)) return { result: null };
          if (args[1] === "EX") ttls.set(key, Number(args[2]));
          return { result: data.get(key) };
        }
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
          if (!data.has(key)) return { result: 0 };
          ttls.set(key, Number(args[1]));
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
