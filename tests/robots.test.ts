import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { profile } from "@/lib/profile";

describe("robots and sitemap", () => {
  it("lets search engines in, keeps the API out (not /admin, which would block /admin-demo), and points at the sitemap", () => {
    const r = robots();
    expect(r.rules).toMatchObject({ allow: "/", disallow: "/api/" });
    expect(r.sitemap).toBe(`${profile.siteUrl}/sitemap.xml`);
  });

  it("lists the public pages on the site's own address", () => {
    expect(sitemap().map((e) => e.url)).toEqual([profile.siteUrl, `${profile.siteUrl}/admin-demo`]);
  });
});
