"use client";

/**
 * Dev-only preview harness for the SHOP DASHBOARD roster (`/studio/shop`).
 * Renders the real `ShopDashboardView` against a mock client seeded with a shop
 * + roster (owner, a managed member, a promotional member, and a pending
 * invite) so the roster + invite form + membership modes render without the
 * live DB (sandbox egress is blocked). Never linked from nav.
 */
import { InkdProvider } from "@inkd/core/hooks";
import { ToastProvider } from "@inkd/ui/web";
import { ShopDashboardView } from "@/components/shop/ShopDashboardView";
import { createMockShopClient } from "../mockShopClient";

const NOW = "2026-07-16T12:00:00.000Z";
const DESMOND_P = "p-desmond";
const DESMOND_A = "a-desmond";
const SHOP = "shop-demo";

function memberRow(
  id: string,
  handle: string,
  name: string,
  role: string,
  mode: string,
  status: string,
  createdAt: string,
) {
  return {
    id,
    shop_id: SHOP,
    artist_profile_id: `a-${handle}`,
    role,
    membership_mode: mode,
    status,
    invited_by: DESMOND_P,
    invited_at: NOW,
    joined_at: status === "active" ? NOW : null,
    created_at: createdAt,
    updated_at: NOW,
    // embedded shape the roster select expects (mock ignores column list)
    artist: {
      id: `a-${handle}`,
      profile_id: `p-${handle}`,
      classification: null,
      profile: { handle, display_name: name, avatar_url: null, city: "Baltimore", state: "MD" },
    },
  };
}

const client = createMockShopClient({
  userId: DESMOND_P,
  profiles: [
    {
      id: DESMOND_P,
      handle: "desmond-wright",
      display_name: "Desmond Wright",
      avatar_url: null,
      is_artist: true,
      is_public: true,
      city: "Baltimore",
      state: "MD",
      created_at: NOW,
      updated_at: NOW,
    },
  ],
  artist_profiles: [
    { id: DESMOND_A, profile_id: DESMOND_P, classification: "shop_owner", is_published: true, created_at: NOW, updated_at: NOW },
  ],
  shops: [
    {
      id: SHOP,
      owner_artist_id: DESMOND_A,
      name: "Fells Point Ink",
      handle: "fells-point-ink",
      bio: "A Fells Point tattoo shop in Baltimore.",
      avatar_url: null,
      primary_location_id: null,
      is_published: true,
      created_at: NOW,
      updated_at: NOW,
    },
  ],
  shop_members: [
    memberRow("m-owner", "desmond-wright", "Desmond Wright", "owner", "managed", "active", "2026-07-01T00:00:00Z"),
    memberRow("m-marcus", "marcus-vane", "Marcus Vane", "resident", "managed", "active", "2026-07-02T00:00:00Z"),
    memberRow("m-sofia", "sofia-marchetti", "Sofia Marchetti", "resident", "promotional", "active", "2026-07-03T00:00:00Z"),
    memberRow("m-priya", "priya-anand", "Priya Anand", "guest", "promotional", "invited", "2026-07-04T00:00:00Z"),
  ],
});

export default function ShopDashboardPreviewPage() {
  return (
    <ToastProvider>
      <InkdProvider client={client}>
        <div className="mx-auto w-full max-w-4xl px-5 py-8">
          <ShopDashboardView />
        </div>
      </InkdProvider>
    </ToastProvider>
  );
}
