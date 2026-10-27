// Security headers sent with every response. The Content-Security-Policy is built for what this site really loads:
// its own scripts, styles and self-hosted fonts, screenshots as data: images, and requests only to itself.

export type Header = { key: string; value: string };

/**
 * The policy. 'unsafe-inline' is needed for scripts because Next.js puts its hydration data in inline scripts, and for
 * styles because React and the font loader set them inline. Everything else is locked down to the site itself.
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'", // nobody may put this site, or its /admin login, in a frame
  "upgrade-insecure-requests",
].join("; ");

/** `dev` leaves out the policy: Next's dev server needs eval and websockets that the policy would block. */
export function securityHeaders(dev: boolean): Header[] {
  return [
    ...(dev ? [] : [{ key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY }]),
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" }, // older browsers; frame-ancestors covers the rest
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ];
}
