"use client";

/**
 * Dev-only preview harness for the artist BOOKINGS inbox — the real
 * `ArtistBookings` (Inbox / Pipeline / Calendar sub-tabs + the request rows)
 * against an offline mock client. Exists to screenshot the restyled sub-tabs
 * and the "New" (violet) vs "Medical" (alert-red) badge differentiation on one
 * inbox row. Never linked from product nav. Not for production use.
 */
import { useMemo } from "react";
import { InkdProvider } from "@inkd/core/hooks";
import { ToastProvider } from "@inkd/ui/web";
import { ArtistBookings } from "@/components/bookings/artist-bookings";
import { createMockSettingsClient } from "../settings-preview/mockSettingsClient";

const PROFILE_ID = "demo-profile-bookings";
const ARTIST_ID = "demo-artist-bookings";
const NOW = new Date("2026-07-15T20:00:00.000Z");
const iso = (offsetDays = 0) =>
  new Date(NOW.getTime() + offsetDays * 86_400_000).toISOString();

const req = (over: Record<string, unknown>) => ({
  artist_id: ARTIST_ID,
  client_id: "client-x",
  service_id: null,
  location_id: null,
  placement: "forearm",
  size_description: "4in",
  description: "Custom blackwork piece",
  reference_uploads: [],
  preferred_dates: [],
  budget_min_cents: 20000,
  budget_max_cents: 40000,
  has_medical_flags: false,
  is_cover_up: false,
  is_first_tattoo: false,
  created_at: iso(-1),
  updated_at: iso(-1),
  ...over,
});

const seedTables = {
  booking_requests: [
    req({
      id: "req-1",
      status: "pending",
      placement: "forearm",
      description: "Blackwork sleeve, half-day",
      is_first_tattoo: true,
      created_at: iso(-0.2),
    }),
    // The differentiation case: a NEW request that ALSO carries a medical flag.
    req({
      id: "req-2",
      status: "pending",
      placement: "ribs",
      description: "Fine-line florals, medical disclosure attached",
      has_medical_flags: true,
      created_at: iso(-0.6),
    }),
    req({
      id: "req-3",
      status: "reviewing",
      placement: "shoulder",
      description: "Neo-traditional rose",
      created_at: iso(-1.4),
    }),
    req({
      id: "req-4",
      status: "accepted",
      placement: "calf",
      description: "Japanese koi, multi-session",
      created_at: iso(-3),
    }),
  ],
  bookings: [],
  sessions: [],
};

export default function BookingsInboxPreviewPage() {
  const client = useMemo(
    () => createMockSettingsClient({ profileId: PROFILE_ID, tables: seedTables }),
    [],
  );

  return (
    <InkdProvider client={client}>
      <ToastProvider>
        <div className="min-h-dvh bg-surface-base">
          <div className="mx-auto w-full max-w-4xl px-5 py-10 md:px-8">
            <ArtistBookings artistId={ARTIST_ID} artistProfileId={PROFILE_ID} />
          </div>
        </div>
      </ToastProvider>
    </InkdProvider>
  );
}
