import { describe, expect, it } from "vitest";
import { MAX_INPUT } from "@/lib/limits";
import { parseRequest, visitorAddress, visitorMessage } from "@/lib/server/runApi";

describe("parseRequest", () => {
  it("trims and collapses whitespace and control characters", () => {
    expect(parseRequest({ request: "  add\u0000 a   due\tdate\n" })).toEqual({ ok: true, request: "add a due date" });
  });
  it("rejects missing, empty and non-string input", () => {
    for (const body of [null, {}, { request: "" }, { request: "   " }, { request: 42 }]) {
      expect(parseRequest(body)).toMatchObject({ ok: false });
    }
  });
  it("rejects ideas that are too long", () => {
    expect(parseRequest({ request: "x".repeat(MAX_INPUT) }).ok).toBe(true);
    expect(parseRequest({ request: "x".repeat(MAX_INPUT + 1) })).toMatchObject({ ok: false });
  });
});

describe("visitorAddress", () => {
  it("uses the first forwarded address, then the real-ip header, then unknown", () => {
    expect(visitorAddress(new Headers({ "x-forwarded-for": "1.1.1.1, 2.2.2.2" }))).toBe("1.1.1.1");
    expect(visitorAddress(new Headers({ "x-real-ip": "3.3.3.3" }))).toBe("3.3.3.3");
    expect(visitorAddress(new Headers())).toBe("unknown");
  });
});

describe("visitorMessage", () => {
  it("passes our own short messages through", () => {
    expect(visitorMessage(new Error("This run hit its spending limit and was stopped."))).toMatch(/spending limit/);
  });
  it("hides anything that mentions the API, keys or auth, and non-errors", () => {
    for (const err of [new Error("401 invalid x-api-key"), new Error("Authentication failed"), "boom", new Error("x".repeat(200))]) {
      expect(visitorMessage(err)).toBe("The run stopped before it finished. Try again in a moment.");
    }
  });
});
