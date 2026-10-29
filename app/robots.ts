import type { MetadataRoute } from "next";
import { profile } from "@/lib/profile";

/**
 * Search engines get the public pages and the API stays out. The admin login is not listed here: "/admin" would also
 * block /admin-demo, and the login page already says noindex, which a crawler can only read if it may fetch the page.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: `${profile.siteUrl}/sitemap.xml`,
    host: profile.siteUrl,
  };
}
