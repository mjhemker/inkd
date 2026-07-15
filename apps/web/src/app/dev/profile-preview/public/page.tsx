"use client";

/**
 * Dev-only preview harness for the PUBLIC artist profile
 * (`/a/[handle]`). Renders the real `ArtistProfileView` component directly
 * against mock `PublicArtistData` — no mock Supabase client needed here,
 * since `ArtistProfileView` takes fully-resolved data as a prop rather than
 * reading through hooks. See ../page.tsx for the own-profile equivalent and
 * ../mockSupabaseClient.ts for why this harness exists (sandbox egress to
 * the live Supabase project is blocked for this session).
 *
 * Never linked from product nav. Not for production use.
 */
import { ArtistProfileView } from "../../../a/[handle]/_components/ArtistProfileView";
import { publicDemoData } from "../publicData";

export default function PublicProfilePreviewPage() {
  return <ArtistProfileView data={publicDemoData} />;
}
