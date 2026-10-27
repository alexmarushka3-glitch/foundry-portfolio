import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import Logo, { LOGO_COLORS } from "@/components/Logo";
import { profile } from "@/lib/profile";

// The picture shown when the site is shared (LinkedIn, Slack, iMessage): the mark, the title and one line.
export const alt = `${profile.headline}: a team of AI agents, by ${profile.name}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The image renderer needs the font file itself (woff, not woff2); the site's web font does not carry over.
const fontFile = (weight: 400 | 700) => readFile(join(process.cwd(), `assets/fonts/schibsted-grotesk-latin-${weight}-normal.woff`));

export default async function OpengraphImage() {
  const [regular, bold] = await Promise.all([fontFile(400), fontFile(700)]);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "#eef0f0",
          color: "#161a1e",
          fontFamily: "Schibsted Grotesk",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 36 }}>
          <Logo size={132} />
          <div style={{ fontSize: 148, fontWeight: 700, letterSpacing: -6, lineHeight: 1 }}>{profile.headline}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", fontSize: 40, lineHeight: 1.3, maxWidth: 1056, color: "#1e252b" }}>
            <div>A specific change goes in.</div>
            <div>A draft pull request comes out,</div>
            <div>checked by other agents and real tests.</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 28, color: "#4b555e" }}>
            <div style={{ width: 14, height: 14, borderRadius: 7, background: LOGO_COLORS.amber }} />
            {profile.name}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Schibsted Grotesk", data: regular, weight: 400, style: "normal" },
        { name: "Schibsted Grotesk", data: bold, weight: 700, style: "normal" },
      ],
    },
  );
}
