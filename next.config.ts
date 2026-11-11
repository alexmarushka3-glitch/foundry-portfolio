import type { NextConfig } from "next";
import { fullscreenHeaders, previewHeaders, securityHeaders } from "./lib/securityHeaders";

const nextConfig: NextConfig = {
  poweredByHeader: false, // don't announce the framework on every response
  async headers() {
    return [
      // Every page but the app preview files, which get their own, tighter policies below.
      {
        source: "/((?!preview/).*)",
        headers: securityHeaders(process.env.NODE_ENV !== "production"),
      },
      // The full-screen page (its own tab) and its script; the frame and runner it embeds keep the preview policy.
      { source: "/preview/full.html", headers: fullscreenHeaders() },
      { source: "/preview/((?!full\\.html).*)", headers: previewHeaders() },
      { source: "/admin", headers: [{ key: "Cache-Control", value: "no-store" }] },
      { source: "/api/admin/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
  },
};

export default nextConfig;
