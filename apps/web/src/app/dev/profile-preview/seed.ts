/**
 * Baseline data for the /dev/profile-preview harness — mirrors the real
 * `demo-folio-artist@inkd.test` row seeded in Supabase (project
 * khlpidflnvkqafkvkpfy) via MCP, plus portfolio/post/flash content the live
 * upload flow can't produce in this sandbox (egress to the Supabase project
 * is blocked for this session — see mockSupabaseClient.ts).
 */
import { abstract_1, abstract_2, abstract_3, abstract_4, abstract_5 } from "./demoImages";
import type { MockSeed } from "./mockSupabaseClient";

export const DEMO_PROFILE_ID = "65d33373-7004-4862-9540-c069add46a5e";
export const DEMO_ARTIST_ID = "d0f30963-0bcd-4564-afe7-7284313a5a75";

// Reviewer client ids for the seeded reviews below (dev-harness only — the
// live equivalents are the demo-review-* rows seeded via MCP, see
// supabase/migrations comment in ../../../../.. reviews API).
const DEMO_REVIEWER_1_ID = "b1a1c001-0000-4000-8000-000000000001";
const DEMO_REVIEWER_2_ID = "b1a1c001-0000-4000-8000-000000000002";
const DEMO_REVIEWER_3_ID = "b1a1c001-0000-4000-8000-000000000003";

const now = new Date().toISOString();
const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

export const demoSeed: MockSeed = {
  userId: DEMO_PROFILE_ID,
  email: "demo-folio-artist@inkd.test",
  tables: {
    profiles: [
      {
        id: DEMO_PROFILE_ID,
        handle: "demo-folio-nova",
        display_name: "Nova Reyes",
        email: "demo-folio-artist@inkd.test",
        phone: null,
        avatar_url: abstract_2,
        bio: "Baltimore-based tattoo artist working in fine line and botanical illustration.",
        is_artist: true,
        is_public: true,
        city: "Baltimore",
        state: "MD",
        created_at: now,
        updated_at: now,
      },
      // Reviewer client profiles (not artists) — for the Reviews tab byline.
      {
        id: DEMO_REVIEWER_1_ID,
        handle: null,
        display_name: "Priya Manning",
        email: "demo-reviewer-1@inkd.test",
        phone: null,
        avatar_url: abstract_4,
        bio: null,
        is_artist: false,
        is_public: false,
        city: "Baltimore",
        state: "MD",
        created_at: now,
        updated_at: now,
      },
      {
        id: DEMO_REVIEWER_2_ID,
        handle: null,
        display_name: "Jordan Teague",
        email: "demo-reviewer-2@inkd.test",
        phone: null,
        avatar_url: null,
        bio: null,
        is_artist: false,
        is_public: false,
        city: "Towson",
        state: "MD",
        created_at: now,
        updated_at: now,
      },
      {
        id: DEMO_REVIEWER_3_ID,
        handle: null,
        display_name: "Sam Ocasio",
        email: "demo-reviewer-3@inkd.test",
        phone: null,
        avatar_url: abstract_5,
        bio: null,
        is_artist: false,
        is_public: false,
        city: "Baltimore",
        state: "MD",
        created_at: now,
        updated_at: now,
      },
    ],
    artist_profiles: [
      {
        id: DEMO_ARTIST_ID,
        profile_id: DEMO_PROFILE_ID,
        bio: "I've been tattooing for eight years, specializing in fine line botanical work and delicate ornamental pieces. Every session starts with a real consultation — I want the piece to feel like it was always meant to be there.",
        tagline: "Fine line & botanical work, Baltimore",
        styles: [],
        classification: "private_suite",
        travel_fly_out: true,
        travel_house_calls: false,
        travel_at_home: false,
        accepts_new_clients: true,
        years_experience: 8,
        instagram_handle: "nova.ink.demo",
        onboarding_step: 5,
        onboarding_completed_at: now,
        is_published: true,
        stripe_account_id: null,
        stripe_identity_verified: false,
        created_at: now,
        updated_at: now,
      },
    ],
    studio_locations: [
      {
        id: "s1-demo-folio",
        artist_id: DEMO_ARTIST_ID,
        name: "Hampden Private Studio",
        address_line1: "901 W 36th St",
        address_line2: null,
        city: "Baltimore",
        state: "MD",
        postal_code: "21211",
        country: "US",
        lat: null,
        lng: null,
        is_primary: true,
        is_public: true,
        phone: "410-555-0142",
        notes: null,
        created_at: now,
        updated_at: now,
      },
    ],
    styles: [
      { id: "st-fine-line", slug: "fine-line", name: "Fine Line", category: "linework", description: null, sort_order: 60, created_at: now },
      { id: "st-ornamental", slug: "ornamental", name: "Ornamental", category: "linework", description: null, sort_order: 80, created_at: now },
      { id: "st-minimalist", slug: "minimalist", name: "Minimalist", category: "linework", description: null, sort_order: 90, created_at: now },
      { id: "st-floral", slug: "floral-botanical", name: "Floral / Botanical", category: "illustrative", description: null, sort_order: 220, created_at: now },
      { id: "st-blackwork", slug: "blackwork", name: "Blackwork", category: "black", description: null, sort_order: 140, created_at: now },
    ],
    artist_styles: [
      { artist_id: DEMO_ARTIST_ID, style_id: "st-fine-line", created_at: now },
      { artist_id: DEMO_ARTIST_ID, style_id: "st-ornamental", created_at: now },
      { artist_id: DEMO_ARTIST_ID, style_id: "st-floral", created_at: now },
    ],
    services: [
      {
        id: "sv1", artist_id: DEMO_ARTIST_ID, location_id: null, name: "Consultation",
        description: "In-person or video chat to talk placement, size, and design direction.",
        duration_minutes: 20, price_type: "fixed", price_cents: 0, deposit_type: "none",
        deposit_amount_cents: null, deposit_percent: null, break_time_minutes: 0, lead_time_hours: 0,
        is_public: true, video_conferencing: true, add_ons: [], calendar_ref: null, is_preset: true,
        preset_key: "consultation", sort_order: 10, created_at: now, updated_at: now,
      },
      {
        id: "sv2", artist_id: DEMO_ARTIST_ID, location_id: null, name: "Small piece (1 hr)",
        description: "Fine line or single-needle work up to 3 inches.",
        duration_minutes: 60, price_type: "starting_at", price_cents: 15000, deposit_type: "fixed",
        deposit_amount_cents: 5000, deposit_percent: null, break_time_minutes: 0, lead_time_hours: 0,
        is_public: true, video_conferencing: false, add_ons: [], calendar_ref: null, is_preset: true,
        preset_key: "one_hour", sort_order: 20, created_at: now, updated_at: now,
      },
      {
        id: "sv3", artist_id: DEMO_ARTIST_ID, location_id: null, name: "Half day session",
        description: "Larger botanical or ornamental pieces, custom design included.",
        duration_minutes: 240, price_type: "starting_at", price_cents: 55000, deposit_type: "percent",
        deposit_amount_cents: null, deposit_percent: 25, break_time_minutes: 0, lead_time_hours: 0,
        is_public: true, video_conferencing: false, add_ons: [], calendar_ref: null, is_preset: true,
        preset_key: "half_day", sort_order: 30, created_at: now, updated_at: now,
      },
    ],
    availability_rules: [2, 3, 4, 5].map((weekday, i) => ({
      id: `ar-${i}`, artist_id: DEMO_ARTIST_ID, location_id: null, weekday,
      start_time: "11:00:00", end_time: "19:00:00", is_open: true, created_at: now, updated_at: now,
    })).concat([{
      id: "ar-sat", artist_id: DEMO_ARTIST_ID, location_id: null, weekday: 6,
      start_time: "11:00:00", end_time: "17:00:00", is_open: true, created_at: now, updated_at: now,
    }]),
    booking_policies: [
      {
        id: "bp1", artist_id: DEMO_ARTIST_ID, booking_window: "2_3mo", allow_image_uploads: true,
        allow_document_uploads: true, require_medical_disclosure: false, min_notice_hours: 48,
        max_active_requests: null, auto_decline_when_closed: true, custom_intake_fields: [],
        created_at: now, updated_at: now,
      },
    ],
    posts: [
      {
        id: "post-1", artist_id: DEMO_ARTIST_ID, caption: "Fresh botanical sleeve piece from this week — swipe for the line work close-up.",
        media: [{ url: abstract_1 }], cover_url: abstract_1, source: "inkd", instagram_id: null,
        instagram_permalink: null, is_public: true, like_count: 24, created_at: now, updated_at: now,
      },
      {
        id: "post-2", artist_id: DEMO_ARTIST_ID, caption: "Studio update: two new flash sheets dropping Friday.",
        media: [{ url: abstract_3 }], cover_url: abstract_3, source: "inkd", instagram_id: null,
        instagram_permalink: null, is_public: true, like_count: 41, created_at: now, updated_at: now,
      },
    ],
    portfolio_pieces: [
      {
        id: "pp-1", artist_id: DEMO_ARTIST_ID, post_id: null, title: "Botanical forearm piece",
        description: "Fine line florals, healed 6 weeks.", image_url: abstract_1, placement: "Forearm",
        style_tags: ["fine-line", "floral-botanical"], is_healed: true, is_public: true, sort_order: 0,
        created_at: now, updated_at: now,
      },
      {
        id: "pp-2", artist_id: DEMO_ARTIST_ID, post_id: null, title: "Ornamental shoulder cap",
        description: "Custom ornamental design.", image_url: abstract_2, placement: "Shoulder",
        style_tags: ["ornamental"], is_healed: true, is_public: true, sort_order: 1,
        created_at: now, updated_at: now,
      },
      {
        id: "pp-3", artist_id: DEMO_ARTIST_ID, post_id: null, title: "Single-line calf piece",
        description: "Minimalist continuous line.", image_url: abstract_3, placement: "Calf",
        style_tags: ["minimalist", "fine-line"], is_healed: false, is_public: true, sort_order: 2,
        created_at: now, updated_at: now,
      },
      {
        id: "pp-4", artist_id: DEMO_ARTIST_ID, post_id: null, title: "Ribcage botanical",
        description: "Fresh — one week healed.", image_url: abstract_4, placement: "Ribs",
        style_tags: ["floral-botanical"], is_healed: false, is_public: true, sort_order: 3,
        created_at: now, updated_at: now,
      },
      {
        id: "pp-5", artist_id: DEMO_ARTIST_ID, post_id: null, title: "Wrist fine line band",
        description: null, image_url: abstract_5, placement: "Wrist",
        style_tags: ["fine-line"], is_healed: true, is_public: true, sort_order: 4,
        created_at: now, updated_at: now,
      },
    ],
    flash_sheets: [
      {
        id: "fs-1", artist_id: DEMO_ARTIST_ID, title: "Spring Botanical Flash", description: "Ready-to-book florals — first come, first served.",
        cover_url: abstract_4, is_public: true, created_at: now, updated_at: now,
      },
    ],
    flash_items: [
      {
        id: "fi-1", flash_sheet_id: "fs-1", artist_id: DEMO_ARTIST_ID, title: "Wildflower bouquet",
        image_url: abstract_1, price_cents: 18000, is_repeatable: false, is_available: true,
        placement_suggestion: "Forearm", size_inches: 4, sort_order: 0, created_at: now, updated_at: now,
      },
      {
        id: "fi-2", flash_sheet_id: "fs-1", artist_id: DEMO_ARTIST_ID, title: "Single stem rose",
        image_url: abstract_5, price_cents: 9000, is_repeatable: true, is_available: true,
        placement_suggestion: "Wrist", size_inches: 2.5, sort_order: 1, created_at: now, updated_at: now,
      },
      {
        id: "fi-3", flash_sheet_id: "fs-1", artist_id: DEMO_ARTIST_ID, title: "Vine wrap",
        image_url: abstract_3, price_cents: 22000, is_repeatable: false, is_available: false,
        placement_suggestion: "Ankle", size_inches: 6, sort_order: 2, created_at: now, updated_at: now,
      },
    ],
    post_styles: [],
    reviews: [
      {
        id: "rv-demo-1",
        artist_id: DEMO_ARTIST_ID,
        client_id: DEMO_REVIEWER_1_ID,
        booking_id: null,
        rating: 5,
        title: "Exactly what I pictured",
        body: "Nova took my half-formed idea for a botanical piece and made it better than I imagined. The line work healed perfectly and the studio felt calm the whole session.",
        artist_response:
          "Thank you, Priya! Loved building this one with you — see you for the next piece.",
        is_public: true,
        created_at: daysAgo(18),
        updated_at: daysAgo(17),
      },
      {
        id: "rv-demo-2",
        artist_id: DEMO_ARTIST_ID,
        client_id: DEMO_REVIEWER_2_ID,
        booking_id: null,
        rating: 4,
        title: null,
        body: "Great consultation and clean linework. Booking took a couple weeks to lock in, but worth the wait.",
        artist_response: null,
        is_public: true,
        created_at: daysAgo(42),
        updated_at: daysAgo(42),
      },
      {
        id: "rv-demo-3",
        artist_id: DEMO_ARTIST_ID,
        client_id: DEMO_REVIEWER_3_ID,
        booking_id: null,
        rating: 5,
        title: "Second piece with Nova",
        body: "Came back for a wrist piece after the forearm florals healed so well. Same care, same precision.",
        artist_response: "Always a pleasure, Sam — that wrist band healed beautifully.",
        is_public: true,
        created_at: daysAgo(4),
        updated_at: daysAgo(3),
      },
    ],
  },
};
