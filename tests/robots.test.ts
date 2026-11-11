import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { profile } from "@/lib/profile";

describe("robots and sitemap", () => {
  it("lets search engines in, keeps the API out (not /admin, which would block /admin-demo), and points at the sitemap", () => {
    const r = robots();
    expect(r.rules).toMatchObject({ allow: "/", disallow: ["/api/", "/a/"] });
    expect(r.sitemap).toBe(`${profile.siteUrl}/sitemap.xml`);
    expect(r.host).toBeUndefined(); // not a standard robots.txt line
  });

  it("lists only the home page: /admin-demo is made-up data and shouldn't be offered to search", () => {
    expect(sitemap().map((e) => e.url)).toEqual([profile.siteUrl]);
  });
});
