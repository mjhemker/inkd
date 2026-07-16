import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "@/components/providers";
import { themeInitScript } from "@/components/theme-provider";

/**
 * INKD type system (see packages/ui/tokens.cjs for the documented rationale):
 *  --font-display  Bricolage Grotesque — headlines, marquee, gallery placards
 *  --font-sans     Manrope — body + all dense ops UI (default)
 *  --font-mono     JetBrains Mono — eyebrows, IDs, timestamps, agent-log voice
 *  --font-hand     Caveat — hand-marked notes ONLY: annotations, empty-state
 *                  notes, congrats moments, "stamped" price marks. Sparingly,
 *                  never body text. Utility: `font-hand`.
 *
 * Self-hosted from the same open-source files shipped by @expo-google-fonts so
 * web + mobile render the identical faces and the build needs no network.
 */
const display = localFont({
  variable: "--font-display",
  display: "swap",
  src: [
    { path: "./fonts/BricolageGrotesque_600SemiBold.ttf", weight: "600", style: "normal" },
    { path: "./fonts/BricolageGrotesque_700Bold.ttf", weight: "700", style: "normal" },
    { path: "./fonts/BricolageGrotesque_800ExtraBold.ttf", weight: "800", style: "normal" },
  ],
});

const sans = localFont({
  variable: "--font-sans",
  display: "swap",
  src: [
    { path: "./fonts/Manrope_400Regular.ttf", weight: "400", style: "normal" },
    { path: "./fonts/Manrope_500Medium.ttf", weight: "500", style: "normal" },
    { path: "./fonts/Manrope_600SemiBold.ttf", weight: "600", style: "normal" },
    { path: "./fonts/Manrope_700Bold.ttf", weight: "700", style: "normal" },
  ],
});

const mono = localFont({
  variable: "--font-mono",
  display: "swap",
  src: [
    { path: "./fonts/JetBrainsMono_400Regular.ttf", weight: "400", style: "normal" },
    { path: "./fonts/JetBrainsMono_500Medium.ttf", weight: "500", style: "normal" },
    { path: "./fonts/JetBrainsMono_600SemiBold.ttf", weight: "600", style: "normal" },
  ],
});

// Caveat — the hand-marked voice. Used sparingly (annotations, hand-notes,
// congrats, stamped price marks); never body text.
const hand = localFont({
  variable: "--font-hand",
  display: "swap",
  src: [
    { path: "./fonts/Caveat_600SemiBold.ttf", weight: "600", style: "normal" },
    { path: "./fonts/Caveat_700Bold.ttf", weight: "700", style: "normal" },
  ],
});

export const metadata: Metadata = {
  // Resolves relative OG/social image URLs (e.g. the generated
  // /a/[handle]/opengraph-image) to absolute getinkd.co URLs so shared links
  // unfurl correctly regardless of the request origin.
  metadataBase: new URL("https://getinkd.co"),
  title: {
    default: "INKD — the operating system for tattoo artists",
    template: "%s · INKD",
  },
  description:
    "INKD — the operating system for independent tattoo artists. Bookings, clients, and AI staff in one place.",
  applicationName: "INKD",
  // Brand mark → favicons + web app icons (generated from the SVGs in
  // public/brand via scripts/generate-brand-icons.cjs). favicon.ico is also
  // served by the app/favicon.ico file convention for legacy browsers.
  icons: {
    icon: [
      { url: "/brand/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/inkd-mark.svg", type: "image/svg+xml" },
      { url: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/brand/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  // Address-bar tint follows the active theme (dark default, warm paper light).
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0A0A0B" },
    { media: "(prefers-color-scheme: light)", color: "#F6F2E9" },
  ],
  colorScheme: "dark light",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      // The inline script below mutates data-theme before hydration; suppress
      // the expected attribute mismatch warning on <html>.
      suppressHydrationWarning
      className={`${display.variable} ${sans.variable} ${mono.variable} ${hand.variable}`}
    >
      <head>
        {/* No-flash: resolve + apply the stored theme before first paint. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-dvh bg-surface-base font-sans text-content-primary antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
