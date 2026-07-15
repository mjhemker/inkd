import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "INKD",
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
    <html lang="en">
      <body className="min-h-dvh bg-surface-base text-content-primary antialiased">
        {children}
      </body>
    </html>
  );
}
