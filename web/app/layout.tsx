import type { CSSProperties } from "react";
import type { Metadata, Viewport } from "next";
import { Fraunces, IBM_Plex_Mono } from "next/font/google";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  axes: ["opsz", "SOFT", "WONK"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex",
  display: "swap",
});

// General Sans (Indian Type Foundry) is served from Fontshare's CDN; its licence
// does not allow redistributing the font files in a public repository.
const GENERAL_SANS = "https://api.fontshare.com/v2/css?f[]=general-sans@400,500,600&display=swap";

const title = "Tender — checkout for agents";
const description =
  "A PayBox plugin that turns any MoonPay Commerce pay link into a guarded USDC payment on Solana or Base, refuses before anything is signed, and rebuilds the receipt from chain.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: title, template: "%s — Tender" },
  description,
  applicationName: "Tender",
  openGraph: {
    type: "website",
    siteName: "Tender",
    title,
    description,
    url: "/",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
  // The page is designed as a light printed document; ask Dark Reader not to invert it.
  other: { "darkreader-lock": "true" },
};

export const viewport: Viewport = {
  themeColor: "#efece2",
  colorScheme: "only light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${plexMono.variable}`}
      style={{ "--font-general": "'General Sans'" } as CSSProperties}
    >
      <head>
        <link rel="preconnect" href="https://api.fontshare.com" crossOrigin="" />
        <link rel="preconnect" href="https://cdn.fontshare.com" crossOrigin="" />
        <link rel="stylesheet" href={GENERAL_SANS} />
      </head>
      <body>
        <a className="skip" href="#main">
          Skip to content
        </a>
        <div className="ground" aria-hidden="true" />
        <div className="lines" aria-hidden="true" />
        <div className="grain" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
