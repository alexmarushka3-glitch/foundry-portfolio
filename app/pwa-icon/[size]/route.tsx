import { ImageResponse } from "next/og";
import Logo from "@/components/Logo";

// The icon of an app added to a home screen from a hosted link: the Foundry mark, drawn at the size asked for. Only the
// three sizes the manifest and iOS use are served.
const SIZES = new Set([180, 192, 512]);

export async function GET(_req: Request, ctx: { params: Promise<{ size: string }> }) {
  const size = Number((await ctx.params).size);
  if (!SIZES.has(size)) return new Response(null, { status: 404 });
  const image = new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#1e252b" }}>
        <Logo size={size} />
      </div>
    ),
    { width: size, height: size },
  );
  image.headers.set("Cache-Control", "public, max-age=86400");
  return image;
}
