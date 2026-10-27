import { describe, expect, it } from "vitest";
import { EXAMPLE_REQUESTS } from "@/lib/exampleRequests";
import liveRecordings from "@/lib/liveRecordings.json";

describe("shipped example requests", () => {
  it("equal the requests of the shipped live recordings", () => {
    expect(EXAMPLE_REQUESTS).toEqual((liveRecordings.recordings as { request: string }[]).map((r) => r.request));
  });
});
