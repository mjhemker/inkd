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

  return {
    title: name,
    description,
    openGraph: {
      title: `${name} · INKD`,
      description,
      images: data.profile.avatar_url ? [data.profile.avatar_url] : undefined,
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
