import { describe, expect, it } from "vitest";
import { canonicalFiles } from "@/lib/share";
import {
  HmacShareSigner,
  createShareSigner,
  prepareWithin,
  redisKey,
} from "@/lib/server/shareSigner";
import { fakeUpstash } from "./fixtures/fakeUpstash";

const key = (n: number) => async () => Buffer.alloc(32, n);

describe("canonicalFiles", () => {
  it("is the same for the same files in any order, and different when any file differs", () => {
    expect(canonicalFiles({ b: "2", a: "1" })).toBe(canonicalFiles({ a: "1", b: "2" }));
    expect(canonicalFiles({ a: "1" })).not.toBe(canonicalFiles({ a: "2" }));
    expect(canonicalFiles({ a: "1" })).not.toBe(canonicalFiles({ b: "1" }));
    // a name cannot be shifted into the next file's text
    expect(canonicalFiles({ a: "1", b: "" })).not.toBe(canonicalFiles({ a: "1b", "": "" }));
  });
});

describe("HmacShareSigner", () => {
  it("signs nothing until the key is loaded, then signs and verifies", async () => {
    const signer = new HmacShareSigner(key(1));
    const files = { "index.html": "<h1>Hi</h1>" };
    expect(signer.sign(files)).toBeNull();
    expect(signer.verify(files, "0".repeat(64))).toBe(false);
    expect(await signer.prepare()).toBe(true);
    const sig = signer.sign(files)!;
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
    expect(signer.verify(files, sig)).toBe(true);
  });

  it("rejects another key, changed files, and anything that is not a 64-character hex signature", async () => {
    const a = new HmacShareSigner(key(1));
    const b = new HmacShareSigner(key(2));
    await a.prepare();
    await b.prepare();
    const files = { x: "1" };
    const sig = a.sign(files)!;
    expect(b.verify(files, sig)).toBe(false);
    expect(a.verify({ x: "2" }, sig)).toBe(false);
    for (const bad of [undefined, null, 42, "", "abc", sig.toUpperCase(), `${sig}00`, sig.slice(2)])
      expect(a.verify(files, bad)).toBe(false);
  });

  it("loads the key once, and tries again on the next run after a failure", async () => {
    let calls = 0;
    const signer = new HmacShareSigner(async () => {
      if (++calls === 1) throw new Error("database down");
      return Buffer.alloc(32, 3);
    });
    expect(await signer.prepare()).toBe(false);
    expect(await signer.prepare()).toBe(true);
    expect(await signer.prepare()).toBe(true);
    expect(calls).toBe(2);
  });
});

describe("redisKey", () => {
  it("creates the key once and every instance gets the same one, even if two start together", async () => {
    const fake = fakeUpstash();
    const [a, b] = await Promise.all([redisKey(fake.config), redisKey(fake.config)]);
    expect(a.equals(b)).toBe(true);
    expect(a).toHaveLength(32);
    expect(await redisKey(fake.config)).toEqual(a);
    expect(fake.calls[0].commands.map(([c]) => c)).toEqual(["SET", "GET"]);
    expect(fake.calls[0].commands[0]).toContain("NX");
  });

  it("fails rather than signing with something that is not a key", async () => {
    const fake = fakeUpstash();
    fake.data.set("foundry:share:key", "not a key");
    await expect(redisKey(fake.config)).rejects.toThrow(/signing key/);
  });
});

describe("createShareSigner", () => {
  it("works without a database (local work), with a key that belongs to this process", async () => {
    const signer = createShareSigner({});
    expect(await signer.prepare()).toBe(true);
    const files = { a: "1" };
    expect(signer.verify(files, signer.sign(files))).toBe(true);
  });
});

describe("HmacShareSigner.refresh", () => {
  it("picks up a key that was replaced elsewhere, so an old instance accepts new signatures", async () => {
    const mine = new HmacShareSigner(key(1), () => 1_000_000);
    const other = new HmacShareSigner(key(2));
    await mine.prepare();
    await other.prepare();
    const files = { a: "1" };
    const theirs = other.sign(files);
    expect(mine.verify(files, theirs)).toBe(false);
    // the shared key changed: the next load returns the new one
    let current = 1;
    const reloading = new HmacShareSigner(
      async () => Buffer.alloc(32, current),
      () => 1_000_000,
    );
    await reloading.prepare();
    current = 2;
    expect(await reloading.refresh()).toBe(true);
    expect(reloading.verify(files, theirs)).toBe(true);
  });

  it("looks again at most once a minute, so forged signatures cannot make a database read each", async () => {
    let loads = 0;
    let now = 1_000_000;
    const signer = new HmacShareSigner(
      async () => {
        loads++;
        return Buffer.alloc(32, 1);
      },
      () => now,
    );
    await signer.prepare();
    expect(await signer.refresh()).toBe(false); // same key
    for (let i = 0; i < 20; i++) await signer.refresh();
    expect(loads).toBe(2); // the first load and one refresh
    now += 61_000;
    await signer.refresh();
    expect(loads).toBe(3);
  });

  it("keeps the old key when the database cannot be read", async () => {
    let fail = false;
    let now = 1_000_000;
    const signer = new HmacShareSigner(
      async () => {
        if (fail) throw new Error("down");
        return Buffer.alloc(32, 1);
      },
      () => now,
    );
    await signer.prepare();
    const sig = signer.sign({ a: "1" })!;
    fail = true;
    now += 61_000;
    expect(await signer.refresh()).toBe(false);
    expect(signer.verify({ a: "1" }, sig)).toBe(true);
  });
});

describe("prepareWithin", () => {
  it("gives up after the wait when the key never loads, and returns at once when it does", async () => {
    const never = new HmacShareSigner(() => new Promise<Buffer>(() => {}));
    const started = Date.now();
    expect(await prepareWithin(never, 30)).toBe(false);
    expect(Date.now() - started).toBeLessThan(1000);
    expect(await prepareWithin(new HmacShareSigner(key(1)), 5000)).toBe(true);
  });
});
