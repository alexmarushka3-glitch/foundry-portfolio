import { describe, expect, it } from "vitest";
import { bundleApp } from "@/lib/bundle";
import recordings from "@/lib/liveRecordings.json";
import { checkSharedApp, refusedMessage } from "@/lib/server/shareCheck";

const page = (body: string, head = "") =>
  `<!doctype html><html><head><title>T</title>${head}</head><body>${body}</body></html>`;

describe("checkSharedApp", () => {
  it("passes every recorded example app (no false alarms on real builds)", () => {
    type Recording = { events: { event: { type: string; files?: Record<string, string> } }[] };
    const apps = (recordings as unknown as { recordings: Recording[] }).recordings;
    let checked = 0;
    for (const rec of apps) {
      const files = rec.events.find((e) => e.event.type === "files")?.event.files;
      if (!files) continue;
      checked++;
      expect(checkSharedApp(bundleApp(files))).toEqual({ ok: true });
    }
    expect(checked).toBe(3);
  });

  it("passes ordinary app code, including reading the address and flashcards", () => {
    const html = page(
      `<h1>Flashcards</h1><input id="front" placeholder="Front of card"><button>Add card</button>
       <script>const tab = location.hash; document.title = "Cards"; if (a == b && location.pathname == "/") {}</script>`,
    );
    expect(checkSharedApp(html)).toEqual({ ok: true });
  });

  it.each([
    [
      "a card number written in a flashcard app",
      `<p>Card number 3 of 10</p><script>let cardNumber = 3; let location = "Kitchen"; task.location = input.value;</script>`,
    ],
    ["a timer that says security code", `<p>Your security code: 1234 (a cvc of the timer)</p>`],
    [
      "a weather app with a location field",
      `<input name="location" placeholder="City"><script>const { location } = state; state.location = "Paris"; if (a.location == b.location) {}</script>`,
    ],
  ])("passes %s", (_name, body) => {
    expect(checkSharedApp(page(body))).toEqual({ ok: true });
  });

  it("passes a map or address book whose field is called location, even when it calls a method on it", () => {
    const html = page(
      `<script>task.location.assign(place); task.location.href(x); const { location } = item; item.location.replace("a", "b");</script>`,
    );
    expect(checkSharedApp(html)).toEqual({ ok: true });
  });

  it.each([
    ["a password box", `<input type="password">`, /password/],
    [
      "a password box with other attributes first",
      `<input name="p" type='password' />`,
      /password/,
    ],
    ["a card number field", `<input name="card number">`, /card/],
    [
      "a password box hidden behind a > in an earlier attribute",
      `<input value="a>b" type=password>`,
      /password/,
    ],
    ["a password type written with character codes", `<input type="&#112;assword">`, /password/],
    [
      "a card field with a > in an earlier attribute",
      `<input placeholder="a>b" name="cvv">`,
      /card/,
    ],
    [
      "a form action hidden behind a > in an earlier attribute",
      `<form title="a>b" action="https://x.example"></form>`,
      /another site/,
    ],
    ["a card autofill hint", `<input autocomplete="cc-number">`, /card/],
    ["a sign-in lure", `<p>Please verify your account to continue</p>`, /sign-in/],
    [
      "a form that posts elsewhere",
      `<form action="https://evil.example/steal"><input></form>`,
      /another site/,
    ],
    ["a protocol-relative form action", `<form action="//evil.example"></form>`, /another site/],
    [
      "a meta refresh",
      ``,
      /redirects/,
      `<meta http-equiv="refresh" content="0;url=https://x.example">`,
    ],
    [
      "setting location.href",
      `<script>location.href = "https://x.example"</script>`,
      /another page/,
    ],
    ["document.location.href", `<script>document.location.href = "/x"</script>`, /another page/],
    ["window.location.replace", `<script>window.location.replace("/x")</script>`, /another page/],
    [
      "assigning location directly",
      `<script>location = "https://x.example"</script>`,
      /another page/,
    ],
    ["an iframe", `<iframe src="https://x.example"></iframe>`, /embeds/],
    ["a base tag", ``, /embeds/, `<base href="https://x.example/">`],
  ])("refuses a page with %s", (_name, body, reason, head = "") => {
    const result = checkSharedApp(page(body, head));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(reason);
  });

  it("explains a refusal in plain words and points to the other ways to keep the app", () => {
    const message = refusedMessage("it asks for a password");
    expect(message).toContain("can't get a link because it asks for a password");
    expect(message).toContain("save it or open it full screen");
  });
});
