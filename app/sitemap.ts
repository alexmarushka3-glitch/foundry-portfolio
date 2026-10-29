import type { MetadataRoute } from "next";
import { profile } from "@/lib/profile";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: profile.siteUrl, changeFrequency: "weekly", priority: 1 },
    { url: `${profile.siteUrl}/admin-demo`, changeFrequency: "monthly", priority: 0.3 },
  ];
}
