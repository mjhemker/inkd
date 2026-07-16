"use client";

/**
 * Dev-only preview harness for the premium tier scaffold (api/plan.ts): the
 * "INKD Pro — coming soon" placard and the autonomy slider's pilot note +
 * PRO stamp, rendered against a mock Supabase client (same pattern as
 * ai-staff-preview) so it doesn't require a live session. Never linked from
 * product nav.
 */
import { InkdProvider } from "@inkd/core/hooks";
import { ToastProvider } from "@inkd/ui/web";
import type { ArtistProfile } from "@inkd/core";
import { AgentAutonomyEditor, PlanCard } from "@/components/artist";
import { createMockAiStaffClient, type AiStaffSeed } from "../ai-staff-preview/mockAiStaffClient";

const NOW = new Date("2026-07-15T20:00:00.000Z").toISOString();
const PROFILE_ID = "demo-profile-plan";
const ARTIST_ID = "demo-artist-plan";

const artistProfile: ArtistProfile = {
  id: ARTIST_ID,
  profile_id: PROFILE_ID,
  bio: "Black & grey realism, healed-in guarantee.",
  tagline: "Baltimore-based, booking 2-3 months out.",
  styles: ["black_grey", "realism"],
  classification: "private_suite",
  travel_fly_out: false,
  travel_house_calls: false,
  travel_at_home: false,
  accepts_new_clients: true,
  years_experience: 9,
  instagram_handle: "jayden.ink",
  onboarding_step: 5,
  onboarding_completed_at: NOW,
  is_published: true,
  stripe_account_id: null,
  stripe_charges_enabled: false,
  stripe_details_submitted: false,
  stripe_identity_verified: false,
  stripe_onboarding_completed_at: null,
  stripe_payouts_enabled: false,
  plan: "free",
  aftercare_enabled: true,
  waitlist_enabled: true,
  created_at: NOW,
  updated_at: NOW,
};

const seed: AiStaffSeed = {
  profileId: PROFILE_ID,
  profile: {
    id: PROFILE_ID,
    handle: "jayden.ink",
    display_name: "Jayden Cole",
    is_artist: true,
    is_public: true,
    city: "Baltimore",
    state: "MD",
    created_at: NOW,
    updated_at: NOW,
  },
  artistProfile,
  agentSettings: {
    id: "settings-1",
    artist_id: ARTIST_ID,
    // "managed" so the Pro-only autonomy note + stamp render.
    autonomy: "managed",
    action_class_overrides: {},
    front_desk_enabled: true,
    booking_manager_enabled: true,
    studio_manager_enabled: false,
    growth_advisor_enabled: false,
    client_disclosure_enabled: false,
    escalation_keywords: [],
    quote_min_cents: null,
    quote_max_cents: null,
    created_at: NOW,
    updated_at: NOW,
  },
  agentActions: [],
  playbooks: [],
  messages: [],
};

const mockClient = createMockAiStaffClient(seed);

export default function PlanPreviewPage() {
  return (
    <InkdProvider client={mockClient}>
      <ToastProvider>
        <div className="min-h-dvh bg-surface-base text-content-primary">
          <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 py-10">
            <div className="flex flex-col gap-1">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-content-muted">
                Settings preview — Account tab
              </p>
              <h1 className="font-display text-2xl font-bold tracking-tight">
                Plan &amp; autonomy
              </h1>
            </div>
            <PlanCard />
            <div className="flex flex-col gap-1">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-content-muted">
                Settings preview — AI staff tab
              </p>
            </div>
            <AgentAutonomyEditor artist={artistProfile} variant="settings" />
          </main>
        </div>
      </ToastProvider>
    </InkdProvider>
  );
}
