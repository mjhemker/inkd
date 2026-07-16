import type { MetadataRoute } from "next";

/**
 * Web app manifest (PWA). Served at /manifest.webmanifest. Icons are the
 * generated brand marks; theme/background match the DARK default gallery.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "INKD",
    short_name: "INKD",
    description:
      "The operating system for independent tattoo artists — bookings, clients, and AI staff in one place.",
    start_url: "/",
    display: "standalone",
    background_color: "#0A0A0B",
    theme_color: "#0A0A0B",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      {
        src: "/brand/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/inkd-icon-square.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
