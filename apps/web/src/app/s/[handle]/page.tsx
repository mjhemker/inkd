import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicShopData } from "./data";
import { ShopProfileView } from "./_components/ShopProfileView";

interface ShopPageParams {
  handle: string;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<ShopPageParams>;
}): Promise<Metadata> {
  const { handle } = await params;
  const data = await getPublicShopData(handle);
  if (!data) return { title: "Shop not found" };

  const { shop } = data;
  const description =
    shop.bio?.slice(0, 160) ?? `${shop.name} on INKD — a tattoo shop and its resident artists.`;
  const url = `/s/${shop.handle}`;

  return {
    title: shop.name,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "profile",
      url,
      siteName: "INKD",
      title: `${shop.name} · INKD`,
      description,
    },
    twitter: { card: "summary_large_image", title: `${shop.name} · INKD`, description },
  };
}

export default async function ShopProfilePage({
  params,
}: {
  params: Promise<ShopPageParams>;
}) {
  const { handle } = await params;
  const data = await getPublicShopData(handle);
  if (!data) notFound();

  return <ShopProfileView data={data} />;
}
