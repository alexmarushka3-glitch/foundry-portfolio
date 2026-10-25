import { describe, expect, it } from "vitest";
import { encodeEvent, readEvents } from "@/lib/ndjson";
import type { FoundryEvent } from "@/lib/types";

const streamOf = (chunks: (string | Uint8Array)[]) =>
  new ReadableStream<Uint8Array>({
    start(c) {
      const enc = new TextEncoder();
      chunks.forEach((s) => c.enqueue(typeof s === "string" ? enc.encode(s) : s));
      c.close();
    },
  });

const collect = async (chunks: (string | Uint8Array)[]) => {
  const out: FoundryEvent[] = [];
  await readEvents(streamOf(chunks), (e) => out.push(e));
  return out;
};

const a: FoundryEvent = { type: "mode", mode: "live" };
const b: FoundryEvent = { type: "token", agent: "story", round: 1, text: "héllo ✓" };

describe("readEvents", () => {
  it("reads one event per line", async () => {
    expect(await collect([encodeEvent(a) + encodeEvent(b)])).toEqual([a, b]);
  });

  it("joins an event split across chunks, even in the middle of a character", async () => {
    const whole = encodeEvent(b);
    const bytes = new TextEncoder().encode(whole);
    const cut = new TextEncoder().encode(whole.slice(0, whole.indexOf("é"))).length + 1; // between the two bytes of é
    expect(await collect([bytes.slice(0, cut), bytes.slice(cut)])).toEqual([b]);
  });

  it("delivers a last line that has no trailing newline", async () => {
    expect(await collect([encodeEvent(a), JSON.stringify(b)])).toEqual([a, b]);
  });

  it("skips blank lines and rejects garbage with a readable error", async () => {
    expect(await collect(["\n\n", encodeEvent(a)])).toEqual([a]);
    await expect(collect(["not json\n"])).rejects.toThrow(/could not read/);
  });
});
