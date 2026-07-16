/**
 * Dev-only preview harness for the PUBLIC shop page (`/s/[handle]`). Renders the
 * real `ShopProfileView` against mock `PublicShopData` — no client needed, the
 * view takes fully-resolved data as a prop. Exists because sandbox egress to
 * the live Supabase project is blocked for this session. Never linked from nav.
 */
import { ShopProfileView } from "../../s/[handle]/_components/ShopProfileView";
import type { PublicShopData } from "../../s/[handle]/data";

const NOW = "2026-07-16T12:00:00.000Z";

function member(
  id: string,
  handle: string,
  name: string,
  role: string,
  mode: string,
  classification: string,
): PublicShopData["members"][number] {
  return {
    id,
    shop_id: "shop-demo",
    artist_profile_id: `ap-${handle}`,
    role: role as never,
    membership_mode: mode as never,
    status: "active" as never,
    invited_by: null,
    invited_at: NOW,
    joined_at: NOW,
    created_at: NOW,
    updated_at: NOW,
    artist: {
      id: `ap-${handle}`,
      profile_id: `p-${handle}`,
      classification: classification as never,
      profile: {
        handle,
        display_name: name,
        avatar_url: null,
        city: "Baltimore",
        state: "MD" as never,
      },
    },
  } as PublicShopData["members"][number];
}

const data: PublicShopData = {
  shop: {
    id: "shop-demo",
    owner_artist_id: "ap-desmond-wright",
    name: "Fells Point Ink",
    handle: "fells-point-ink",
    bio: "A Fells Point tattoo shop in Baltimore — resident and guest artists across black & grey, traditional and fine-line. Walk-ins welcome, bookings preferred.",
    avatar_url: null,
    primary_location_id: "loc-1",
    is_published: true,
    created_at: NOW,
    updated_at: NOW,
  },
  ownerProfile: {
    id: "p-desmond-wright",
    handle: "desmond-wright",
    display_name: "Desmond Wright",
    email: null,
    phone: null,
    avatar_url: null,
    bio: null,
    is_artist: true,
    is_public: true,
    city: "Baltimore",
    state: "MD" as never,
    created_at: NOW,
    updated_at: NOW,
  },
  isOwner: false,
  locations: [
    {
      id: "loc-1",
      artist_id: "ap-desmond-wright",
      name: "Fells Point Ink",
      address_line1: "1700 Thames St",
      address_line2: null,
      city: "Baltimore",
      state: "MD" as never,
      postal_code: "21231",
      country: "US",
      lat: 39.2819,
      lng: -76.5931,
      is_primary: true,
      is_public: true,
      phone: null,
      notes: null,
      created_at: NOW,
      updated_at: NOW,
    },
  ],
  members: [
    member("m-owner", "desmond-wright", "Desmond Wright", "owner", "managed", "shop_owner"),
    member("m-marcus", "marcus-vane", "Marcus Vane", "resident", "managed", "shop_resident"),
    member("m-sofia", "sofia-marchetti", "Sofia Marchetti", "resident", "promotional", "independent"),
  ],
};

export default function ShopPreviewPage() {
  return <ShopProfileView data={data} />;
}
