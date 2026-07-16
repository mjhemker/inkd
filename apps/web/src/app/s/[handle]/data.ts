import "server-only";

import {
  getShopByHandle,
  getArtistProfileById,
  getProfileById,
  listActiveShopMembers,
  listStudioLocations,
  type ShopRosterMember,
} from "@inkd/core/api";
import type { Profile, Shop, StudioLocation } from "@inkd/core/types";
import { getServerSupabaseClient } from "@/lib/supabase-server";

export interface PublicShopData {
  shop: Shop;
  ownerProfile: Profile | null;
  isOwner: boolean;
  locations: StudioLocation[];
  members: ShopRosterMember[];
}

/**
 * Everything the public shop page needs, fetched server-side under the viewer's
 * own RLS session. Anonymous viewers only see a PUBLISHED shop and its ACTIVE
 * members + PUBLIC locations; the owner previewing their own shop sees it even
 * as a draft.
 */
export async function getPublicShopData(handle: string): Promise<PublicShopData | null> {
  const client = await getServerSupabaseClient();

  const shop = await getShopByHandle(client, handle);
  if (!shop) return null;

  const {
    data: { user },
  } = await client.auth.getUser();

  // The owner (or a manager) can see their own draft shop; anon sees published only.
  const ownerArtist = await getArtistProfileById(client, shop.owner_artist_id);
  const ownerProfile = ownerArtist ? await getProfileById(client, ownerArtist.profile_id) : null;
  const isOwner = Boolean(user && ownerProfile && user.id === ownerProfile.id);

  if (!shop.is_published && !isOwner) return null;

  const [locations, members] = await Promise.all([
    listStudioLocations(client, shop.owner_artist_id),
    listActiveShopMembers(client, shop.id),
  ]);

  return {
    shop,
    ownerProfile,
    isOwner,
    locations: locations.filter((l) => l.is_public || isOwner),
    members,
  };
}
