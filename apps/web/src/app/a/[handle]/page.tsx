import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicArtistData } from "./data";
import { ArtistProfileView } from "./_components/ArtistProfileView";

interface ArtistPageParams {
  handle: string;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<ArtistPageParams>;
}): Promise<Metadata> {
  const { handle } = await params;
  const data = await getPublicArtistData(handle);
  if (!data) return { title: "Artist not found" };

  const name = data.profile.display_name || `@${data.profile.handle}`;
  const description =
    data.artist.tagline ??
    data.artist.bio?.slice(0, 160) ??
    `${name} on INKD — portfolio, flash, and booking.`;
  const url = `/a/${data.profile.handle}`;

  return {
    title: name,
    description,
    alternates: { canonical: url },
    // No manual `images` override here — the /a/[handle]/opengraph-image
    // route (next/og, branded placard) is picked up automatically by Next's
    // file-convention metadata resolution.
    openGraph: {
      type: "profile",
      url,
      siteName: "INKD",
      title: `${name} · INKD`,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title: `${name} · INKD`,
      description,
    },
  };
}

export default async function ArtistProfilePage({
  params,
}: {
  params: Promise<ArtistPageParams>;
}) {
  const { handle } = await params;
  const data = await getPublicArtistData(handle);
  if (!data) notFound();

  return <ArtistProfileView data={data} />;
}
