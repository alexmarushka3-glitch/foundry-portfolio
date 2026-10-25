import { ImageResponse } from "next/og";
import Logo from "@/components/Logo";

// The icon iOS uses when the site is added to a home screen. iOS rounds the corners itself.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#1e252b" }}>
        <Logo size={180} />
      </div>
    ),
    size,
  );
}
