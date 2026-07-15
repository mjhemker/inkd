import { ImageResponse } from "next/og";
import { getPublicArtistData } from "./data";

interface ArtistPageParams {
  handle: string;
}

export const runtime = "nodejs";
export const alt = "An artist's INKD booking profile";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#0A0A0B";
const PAPER = "#FAFAFA";
const VIOLET = "#7C3AED";
const VIOLET_LIGHT = "#A78BFA";
const MUTED = "#A1A1AA";
const PLATE = "#1A1A1D";
const BORDER = "#27272A";

/**
 * Branded, placard-styled OG image for a public artist profile — dark plate,
 * violet frame, mono handle — so a shared `/a/[handle]` link (the "booking
 * deeplink" SPEC §0 calls for) unfurls as an INKD card instead of a bare
 * link preview. Generated per-request with `next/og`; falls back to a
 * generic INKD card if the handle doesn't resolve (unpublished / deleted).
 */
export default async function Image({
  params,
}: {
  params: Promise<ArtistPageParams>;
}) {
  const { handle } = await params;
  // getPublicArtistData hits Supabase; a transient outage should still yield
  // a branded (if generic) card rather than a broken image for crawlers.
  const data = await getPublicArtistData(handle).catch(() => null);

  const displayHandle = data?.profile.handle ?? handle;
  const name = data?.profile.display_name || `@${displayHandle}`;
  const tagline =
    data?.artist.tagline ||
    data?.artist.bio?.slice(0, 140) ||
    "Book direct on INKD — no DMs needed.";
  const primaryLocation =
    data?.studioLocations.find((l) => l.is_primary) ?? data?.studioLocations[0];
  const locationLabel = primaryLocation
    ? [primaryLocation.city, primaryLocation.state].filter(Boolean).join(", ")
    : null;
  const styleNames = (data?.styles ?? []).slice(0, 4).map((s) => s.name);

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: INK,
          color: PAPER,
          padding: "64px",
          position: "relative",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 20,
            left: 20,
            right: 20,
            bottom: 20,
            border: `4px solid ${VIOLET}`,
            display: "flex",
          }}
        />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 800, letterSpacing: -1 }}>
            INKD
          </div>
          {locationLabel && (
            <div
              style={{
                display: "flex",
                fontSize: 20,
                color: MUTED,
                fontFamily: "monospace",
                letterSpacing: 1,
              }}
            >
              {locationLabel.toUpperCase()}
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            justifyContent: "center",
            gap: 20,
            maxWidth: 980,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 22,
              color: VIOLET_LIGHT,
              fontFamily: "monospace",
              letterSpacing: 1,
            }}
          >
            @{displayHandle}
          </div>
          <div style={{ display: "flex", fontSize: 68, fontWeight: 800, lineHeight: 1.08 }}>
            {name}
          </div>
          <div style={{ display: "flex", fontSize: 26, color: "#D4D4D8", maxWidth: 860 }}>
            {tagline}
          </div>
        </div>

        {styleNames.length > 0 && (
          <div style={{ display: "flex", gap: 12, marginBottom: 28 }}>
            {styleNames.map((s) => (
              <div
                key={s}
                style={{
                  display: "flex",
                  padding: "9px 20px",
                  backgroundColor: PLATE,
                  border: `1px solid ${BORDER}`,
                  fontSize: 18,
                  color: "#E4E4E7",
                }}
              >
                {s}
              </div>
            ))}
          </div>
        )}

        <div
          style={{
            display: "flex",
            fontSize: 20,
            color: MUTED,
            fontFamily: "monospace",
          }}
        >
          getinkd.co/a/{displayHandle}
        </div>
      </div>
    ),
    { ...size },
  );
}
