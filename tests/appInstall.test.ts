import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";

// public/app-install.js runs in the wrapper page of a hosted link and offers to add the link as an app, in as few taps
// as the browser allows. Each test loads it into a fresh fake browser with the user agent and state under test.

const SRC = readFileSync("public/app-install.js", "utf8");
const ID = "B".repeat(22);

const CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const MAC_SAFARI_17 =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
const MAC_SAFARI_16 = MAC_SAFARI_17.replace("Version/17.5", "Version/16.6");
const MAC_CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const FIREFOX = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0";

function load(
  opts: {
    ua?: string;
    path?: string;
    touchPoints?: number;
    standaloneMedia?: boolean;
    standaloneIos?: boolean;
    stored?: Record<string, string>;
  } = {},
) {
  const dom = new JSDOM("<!doctype html><body></body>", {
    url: `https://foundry.test${opts.path ?? `/a/${ID}`}`,
    runScripts: "outside-only", // lets the test run the script inside the page
  });
  const w = dom.window as unknown as Window & Record<string, unknown>;
  // jsdom only takes a user agent through a resource loader, so set what the page reads directly
  Object.defineProperty(w.navigator, "userAgent", { value: opts.ua ?? CHROME });
  Object.defineProperty(w.navigator, "maxTouchPoints", { value: opts.touchPoints ?? 0 });
  if (opts.standaloneIos) Object.defineProperty(w.navigator, "standalone", { value: true });
  w.matchMedia = ((q: string) => ({
    matches: !!opts.standaloneMedia && q.includes("standalone"),
  })) as unknown as typeof w.matchMedia;
  for (const [k, v] of Object.entries(opts.stored ?? {})) w.localStorage.setItem(k, v);
  dom.window.eval(SRC);
  const bar = () => w.document.querySelector('[role="region"]') as HTMLElement | null;
  const button = (label: string) =>
    [...w.document.querySelectorAll("button")].find((b) => b.textContent === label) as
      | HTMLButtonElement
      | undefined;
  /** What Chrome and Edge fire when the page can be installed. */
  const offerInstall = () => {
    const e = new dom.window.Event("beforeinstallprompt", { cancelable: true }) as Event & {
      prompt: ReturnType<typeof vi.fn>;
    };
    e.prompt = vi.fn();
    w.dispatchEvent(e);
    return e;
  };
  const fire = (type: string) => w.dispatchEvent(new dom.window.Event(type));
  return { w, bar, button, offerInstall, fire };
}

describe("app-install.js on Chrome and Edge", () => {
  it("shows nothing until the browser says the page can be installed", () => {
    expect(load().bar()).toBeNull();
  });

  it("then offers one Install app button, and says what it adds", () => {
    const page = load();
    const event = page.offerInstall();
    expect(event.defaultPrevented).toBe(true); // kept for the button instead of the browser's own bar
    expect(page.bar()?.textContent).toContain("Install this as an app");
    expect(page.bar()?.textContent).toContain("sits next to your other apps");
    expect(page.button("Install app")).toBeTruthy();
  });

  it("opens the browser's install question on a tap, then takes the bar away", () => {
    const page = load();
    const event = page.offerInstall();
    page.button("Install app")!.click();
    expect(event.prompt).toHaveBeenCalledTimes(1);
    expect(page.bar()).toBeNull();
  });

  it("Not now takes the bar away and stays quiet on later visits", () => {
    const page = load();
    page.offerInstall();
    page.button("Not now")!.click();
    expect(page.bar()).toBeNull();
    expect(page.w.localStorage.getItem(`foundry:install-dismissed:${ID}`)).toMatch(/^\d+$/);
    const later = load({
      stored: { [`foundry:install-dismissed:${ID}`]: String(Date.now() - 1000) },
    });
    later.offerInstall();
    expect(later.bar()).toBeNull();
  });

  it("asks again after a month", () => {
    const old = String(Date.now() - 31 * 24 * 3600 * 1000);
    const page = load({ stored: { [`foundry:install-dismissed:${ID}`]: old } });
    page.offerInstall();
    expect(page.bar()).not.toBeNull();
  });

  it("goes away when the app gets installed", () => {
    const page = load();
    page.offerInstall();
    page.fire("appinstalled");
    expect(page.bar()).toBeNull();
  });

  it("shows only one bar however many times the browser offers", () => {
    const page = load();
    page.offerInstall();
    page.offerInstall();
    expect(page.w.document.querySelectorAll('[role="region"]')).toHaveLength(1);
  });

  it("shows nothing when it is already open as an installed app", () => {
    const page = load({ standaloneMedia: true });
    page.offerInstall();
    expect(page.bar()).toBeNull();
  });
});

describe("app-install.js on Apple devices, which let no website start an install", () => {
  it("tells an iPhone what to tap, right away, and says what it adds", () => {
    const page = load({ ua: IPHONE, touchPoints: 5 });
    const text = page.bar()!.textContent!;
    expect(text).toContain("tap ⋯, then Share, then Add to Home Screen");
    expect(text).toContain("sits next to your other apps");
    expect(page.button("Install app")).toBeUndefined(); // there is no such button on iOS
  });

  it("does the same on an iPad that asks for the computer site", () => {
    const page = load({ ua: MAC_SAFARI_17, touchPoints: 5 });
    expect(page.bar()?.textContent).toContain("Add to Home Screen");
  });

  it("Got it takes the note away and stays quiet on later visits", () => {
    const page = load({ ua: IPHONE, touchPoints: 5 });
    page.button("Got it")!.click();
    expect(page.bar()).toBeNull();
    const later = load({
      ua: IPHONE,
      touchPoints: 5,
      stored: { [`foundry:install-dismissed:${ID}`]: String(Date.now()) },
    });
    expect(later.bar()).toBeNull();
  });

  it("shows nothing once it is opened from the Home Screen", () => {
    expect(load({ ua: IPHONE, touchPoints: 5, standaloneIos: true }).bar()).toBeNull();
    expect(load({ ua: IPHONE, touchPoints: 5, standaloneMedia: true }).bar()).toBeNull();
  });

  it("tells Safari 17 or newer on a Mac to use Add to Dock", () => {
    expect(load({ ua: MAC_SAFARI_17 }).bar()?.textContent).toContain("File, then Add to Dock");
  });

  it("says nothing on an older Safari, or on Chrome for a Mac until it offers the install", () => {
    expect(load({ ua: MAC_SAFARI_16 }).bar()).toBeNull();
    const chrome = load({ ua: MAC_CHROME });
    expect(chrome.bar()).toBeNull();
    chrome.offerInstall();
    expect(chrome.button("Install app")).toBeTruthy();
  });
});

describe("app-install.js elsewhere", () => {
  it("says nothing in a browser that cannot install apps (Firefox on a computer)", () => {
    expect(load({ ua: FIREFOX }).bar()).toBeNull();
  });

  it("does nothing on a page that is not a hosted link", () => {
    const page = load({ ua: IPHONE, touchPoints: 5, path: "/somewhere/else" });
    expect(page.bar()).toBeNull();
    page.offerInstall();
    expect(page.bar()).toBeNull();
  });

  it("keeps working when the browser will not let the page remember a choice", () => {
    const page = load({ ua: IPHONE, touchPoints: 5 });
    Object.defineProperty(page.w, "localStorage", {
      get() {
        throw new Error("blocked");
      },
    });
    expect(() => page.button("Got it")!.click()).not.toThrow();
    expect(page.bar()).toBeNull();
  });
});
