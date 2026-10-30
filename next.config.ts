import type { NextConfig } from "next";
import { previewHeaders, securityHeaders } from "./lib/securityHeaders";

const nextConfig: NextConfig = {
  poweredByHeader: false, // don't announce the framework on every response
  async headers() {
    return [
      // Every page but the app preview frame, which gets its own, tighter policy below.
      { source: "/((?!preview/).*)", headers: securityHeaders(process.env.NODE_ENV !== "production") },
      { source: "/preview/:path*", headers: previewHeaders() },
      { source: "/admin", headers: [{ key: "Cache-Control", value: "no-store" }] },
      { source: "/api/admin/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
  },
};

export default nextConfig;
