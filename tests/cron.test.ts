import { afterEach, describe, expect, it, vi } from "vitest";

const gh = vi.hoisted(() => ({ configured: true, closeStale: vi.fn(async () => ({ closed: 2 })) }));
vi.mock("@/lib/pipeline/github", () => ({
  STALE_AFTER_MS: 86_400_000,
  githubConfigured: () => gh.configured,
  createGithubClient: () => ({ closeStale: gh.closeStale }),
}));

import { GET } from "@/app/api/cron/close-stale-prs/route";

const call = (auth?: string) => GET(new Request("http://t/api/cron/close-stale-prs", { headers: auth ? { authorization: auth } : {} }));

afterEach(() => {
  delete process.env.CRON_SECRET;
  gh.configured = true;
  gh.closeStale.mockClear();
});

describe("GET /api/cron/close-stale-prs", () => {
  it("does not exist without CRON_SECRET", async () => {
    expect((await call()).status).toBe(404);
    expect(gh.closeStale).not.toHaveBeenCalled();
  });

  it("rejects a missing or wrong secret", async () => {
    process.env.CRON_SECRET = "s3cret";
    expect((await call()).status).toBe(401);
    expect((await call("Bearer nope")).status).toBe(401);
    expect(gh.closeStale).not.toHaveBeenCalled();
  });

  it("closes stale pull requests for the right secret", async () => {
    process.env.CRON_SECRET = "s3cret";
    const res = await call("Bearer s3cret");
    expect(await res.json()).toEqual({ closed: 2 });
    expect(gh.closeStale).toHaveBeenCalledWith(86_400_000);
  });

  it("does nothing, harmlessly, when GitHub is not set up", async () => {
    process.env.CRON_SECRET = "s3cret";
    gh.configured = false;
    expect(await (await call("Bearer s3cret")).json()).toMatchObject({ closed: 0 });
    expect(gh.closeStale).not.toHaveBeenCalled();
  });
});
