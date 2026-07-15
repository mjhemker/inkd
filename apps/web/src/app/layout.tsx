import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "@/components/providers";

/**
 * INKD type system (see packages/ui/tokens.cjs for the documented rationale):
 *  --font-display  Bricolage Grotesque — headlines, marquee, gallery placards
 *  --font-sans     Manrope — body + all dense ops UI (default)
 *  --font-mono     JetBrains Mono — eyebrows, IDs, timestamps, agent-log voice
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

export const metadata: Metadata = {
  title: {
    default: "INKD — the operating system for tattoo artists",
    template: "%s · INKD",
  },
  description:
    "INKD — the operating system for independent tattoo artists. Bookings, clients, and AI staff in one place.",
  applicationName: "INKD",
};

export const viewport: Viewport = {
  themeColor: "#0A0A0B",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} ${mono.variable}`}
    >
      <body className="min-h-dvh bg-surface-base font-sans text-content-primary antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
