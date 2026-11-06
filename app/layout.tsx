import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Schibsted_Grotesk } from "next/font/google";
import "./globals.css";
import { profile } from "@/lib/profile";

const sans = Schibsted_Grotesk({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(profile.siteUrl),
  title: `${profile.headline} | ${profile.name}`,
  description: profile.pitch,
};

export const viewport: Viewport = { themeColor: "#EEF0F0" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        {children}
        {/* Vercel Web Analytics: page views only, no cookies. The script is served from this site (/_vercel/insights),
            so the content security policy needs no outside host. Only on Vercel builds, and Analytics must be enabled
            in the Vercel project (Analytics tab) or the script 404s. */}
        {process.env.VERCEL === "1" && <script defer src="/_vercel/insights/script.js" />}
      </body>
    </html>
  );
}
