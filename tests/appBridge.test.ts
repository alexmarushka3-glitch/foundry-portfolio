// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { HOSTED_STORAGE_MAX } from "@/lib/share";

// public/app-bridge.js runs in the wrapper page of a hosted link and keeps the sealed app's data. The app is untrusted:
// everything it sends is checked here the way a hostile app would try it.

const ID = "B".repeat(22);
const PREFIX = `foundry:app:${ID}:`;
let frame: HTMLIFrameElement;
let reply: ReturnType<typeof vi.fn>;

/** Sends a message the way the framed app would (from the frame's window), or from another source. */
const send = (data: unknown, fromFrame = true) =>
  window.dispatchEvent(
    new MessageEvent("message", {
      data,
      source: fromFrame ? frame.contentWindow : window,
    }),
  );

beforeAll(() => {
  window.history.pushState({}, "", `/a/${ID}`);
  frame = document.createElement("iframe");
  document.body.appendChild(frame);
  const src = readFileSync("public/app-bridge.js", "utf8");
  new Function(src)(); // the listener lives for the whole file, like it does on the page
});

beforeEach(() => {
  localStorage.clear();
  reply = vi.fn();
  frame.contentWindow!.postMessage = reply as unknown as typeof window.postMessage;
  document.title = "Foundry app";
});

describe("app-bridge.js", () => {
  it("answers hello with this link's saved data only, and names the window after the app", () => {
    localStorage.setItem(`${PREFIX}count`, "3");
    localStorage.setItem(`foundry:app:${"C".repeat(22)}:count`, "other link");
    localStorage.setItem("theme", "dark");
    send({ type: "hosted-hello", title: "Counter\u0007" });
    expect(reply).toHaveBeenCalledTimes(1);
    const [message] = reply.mock.calls[0];
    expect(message.type).toBe("hosted-storage");
    expect({ ...message.items }).toEqual({ count: "3" });
    expect(document.title).toBe("Counter");
  });

  it("ignores messages from anything but its own frame", () => {
    send({ type: "hosted-set", key: "a", value: "1" }, false);
    send({ type: "hosted-hello", title: "x" }, false);
    expect(localStorage.length).toBe(0);
    expect(reply).not.toHaveBeenCalled();
  });

  it("keeps, removes and clears under this link's prefix, and never touches other keys", () => {
    localStorage.setItem("theme", "dark");
    localStorage.setItem(`foundry:app:${"C".repeat(22)}:keep`, "x");
    send({ type: "hosted-set", key: "a", value: "1" });
    send({ type: "hosted-set", key: "b", value: "2" });
    expect(localStorage.getItem(`${PREFIX}a`)).toBe("1");
    send({ type: "hosted-remove", key: "a" });
    expect(localStorage.getItem(`${PREFIX}a`)).toBeNull();
    send({ type: "hosted-clear" });
    expect(localStorage.getItem(`${PREFIX}b`)).toBeNull();
    expect(localStorage.getItem("theme")).toBe("dark");
    expect(localStorage.getItem(`foundry:app:${"C".repeat(22)}:keep`)).toBe("x");
  });

  it("refuses wrong types, an over-long key and a message with no type", () => {
    send({ type: "hosted-set", key: 5, value: "1" });
    send({ type: "hosted-set", key: "a", value: { big: true } });
    send({ type: "hosted-set", key: "k".repeat(257), value: "1" });
    send({ key: "a", value: "1" });
    send(null);
    send("hosted-set");
    expect(localStorage.length).toBe(0);
  });

  it("stops at the size cap, counting every key, including __proto__", () => {
    const half = "x".repeat(HOSTED_STORAGE_MAX / 2 - 10);
    send({ type: "hosted-set", key: "a", value: half });
    send({ type: "hosted-set", key: "b", value: half });
    expect(localStorage.getItem(`${PREFIX}b`)).toBe(half);
    send({ type: "hosted-set", key: "c", value: "y".repeat(100) }); // over the cap: refused
    expect(localStorage.getItem(`${PREFIX}c`)).toBeNull();
    // a key named __proto__ is stored and counted like any other, so it cannot be used to go past the cap
    send({ type: "hosted-set", key: "__proto__", value: "z".repeat(HOSTED_STORAGE_MAX) });
    expect(localStorage.getItem(`${PREFIX}__proto__`)).toBeNull();
    localStorage.clear();
    send({ type: "hosted-set", key: "__proto__", value: "ok" });
    expect(localStorage.getItem(`${PREFIX}__proto__`)).toBe("ok");
    send({ type: "hosted-hello", title: "t" });
    expect(reply.mock.calls.at(-1)![0].items["__proto__"]).toBe("ok");
  });
});
