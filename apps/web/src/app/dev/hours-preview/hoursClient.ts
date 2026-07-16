/**
 * In-memory fake Supabase client for the offline weekly-hours PREVIEW harness.
 * Seeds an artist with a split Tuesday (11:00–14:00 + 17:00–21:00) plus a
 * single upcoming time-off block so the WeeklyHoursGrid renders multi-block
 * days and time-off shading without a network. Not used in the app.
 */
import type { InkdSupabaseClient } from "@inkd/core";

const now = new Date().toISOString();

const USER = { id: "hours-demo-user", email: "hours-demo@inkd.test" };

const PROFILE = {
  id: "hours-demo-user",
  handle: "demo-hours-jayden",
  display_name: "Jayden Cole",
  email: USER.email,
  avatar_url: null,
  bio: "Baltimore blackwork & fine line.",
  is_artist: true,
  is_public: true,
  city: "Baltimore",
  state: "MD",
  phone: null,
  created_at: now,
  updated_at: now,
};

const ARTIST = {
  id: "hours-demo-artist",
  profile_id: "hours-demo-user",
  bio: "Baltimore blackwork & fine line.",
  tagline: null,
  styles: ["blackwork", "fine-line"],
  classification: "shop_resident",
  travel_fly_out: false,
  travel_house_calls: false,
  travel_at_home: false,
  accepts_new_clients: true,
  years_experience: 6,
  instagram_handle: null,
  onboarding_step: 2,
  onboarding_completed_at: null,
  is_published: true,
  stripe_account_id: null,
  stripe_identity_verified: false,
  created_at: now,
  updated_at: now,
};

// A realistic week: Tue is split (two blocks), Wed/Thu/Fri/Sat single windows.
const RULES = [
  { id: "r-tue-am", artist_id: "hours-demo-artist", location_id: null, weekday: 2, start_time: "11:00:00", end_time: "14:00:00", is_open: true, created_at: now, updated_at: now },
  { id: "r-tue-pm", artist_id: "hours-demo-artist", location_id: null, weekday: 2, start_time: "17:00:00", end_time: "21:00:00", is_open: true, created_at: now, updated_at: now },
  { id: "r-wed", artist_id: "hours-demo-artist", location_id: null, weekday: 3, start_time: "11:00:00", end_time: "19:00:00", is_open: true, created_at: now, updated_at: now },
  { id: "r-thu", artist_id: "hours-demo-artist", location_id: null, weekday: 4, start_time: "11:00:00", end_time: "19:00:00", is_open: true, created_at: now, updated_at: now },
  { id: "r-fri", artist_id: "hours-demo-artist", location_id: null, weekday: 5, start_time: "12:00:00", end_time: "20:00:00", is_open: true, created_at: now, updated_at: now },
  { id: "r-sat", artist_id: "hours-demo-artist", location_id: null, weekday: 6, start_time: "10:00:00", end_time: "16:00:00", is_open: true, created_at: now, updated_at: now },
];

// One upcoming time-off block (next Monday, 2 days), so a day column shades.
function upcomingMonday(): { start: string; end: string } {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const delta = (8 - day) % 7 || 7; // next Monday
  const start = new Date(d.getTime() + delta * 86400000);
  const end = new Date(start.getTime() + 86400000);
  return { start: start.toISOString(), end: end.toISOString() };
}

const off = upcomingMonday();
const BLOCKS = [
  {
    id: "blk-1",
    artist_id: "hours-demo-artist",
    location_id: null,
    block_type: "vacation",
    starts_at: off.start,
    ends_at: off.end,
    is_available: false,
    reason: "Studio closed",
    created_at: now,
    updated_at: now,
  },
];

const POLICY = {
  id: "pol-1",
  artist_id: "hours-demo-artist",
  booking_window: "2_3mo",
  allow_image_uploads: true,
  allow_document_uploads: false,
  require_medical_disclosure: false,
  min_notice_hours: 24,
  max_active_requests: null,
  auto_decline_when_closed: true,
  custom_intake_fields: [],
  created_at: now,
  updated_at: now,
};

function dataFor(table: string, single: boolean): unknown {
  switch (table) {
    case "profiles":
      return single ? PROFILE : [PROFILE];
    case "artist_profiles":
      return single ? ARTIST : [ARTIST];
    case "availability_rules":
      return RULES;
    case "availability_blocks":
      return BLOCKS;
    case "booking_policies":
      return single ? POLICY : [POLICY];
    default:
      return single ? null : [];
  }
}

function makeBuilder(table: string) {
  let mutated: unknown;
  let isDelete = false;

  function resolve(kind: "list" | "single") {
    if (isDelete) return Promise.resolve({ data: null, error: null });
    if (mutated !== undefined) {
      const base = (dataFor(table, true) as Record<string, unknown>) ?? {};
      const merged = { ...base, ...(mutated as Record<string, unknown>), id: (base as { id?: string }).id ?? `demo-${table}` };
      return Promise.resolve({ data: kind === "list" ? [merged] : merged, error: null });
    }
    const d = dataFor(table, kind === "single");
    return Promise.resolve({ data: d, error: null, count: Array.isArray(d) ? d.length : 0 });
  }

  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: () => builder,
    neq: () => builder,
    ilike: () => builder,
    is: () => builder,
    in: () => builder,
    gte: () => builder,
    lte: () => builder,
    order: () => builder,
    range: () => builder,
    limit: () => builder,
    insert: (row: unknown) => {
      mutated = Array.isArray(row) ? row[0] : row;
      return builder;
    },
    update: (row: unknown) => {
      mutated = row;
      return builder;
    },
    upsert: (row: unknown) => {
      mutated = Array.isArray(row) ? row[0] : row;
      return builder;
    },
    delete: () => {
      isDelete = true;
      return builder;
    },
    maybeSingle: () => resolve("single"),
    single: () => resolve("single"),
    then: (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) =>
      resolve("list").then(onF, onR),
  };
  return builder;
}

export function createHoursClient(): InkdSupabaseClient {
  const client = {
    from: (table: string) => makeBuilder(table),
    auth: {
      getUser: async () => ({ data: { user: USER }, error: null }),
      getSession: async () => ({ data: { session: { user: USER } }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signOut: async () => ({ error: null }),
    },
  };
  return client as unknown as InkdSupabaseClient;
}

export const HOURS_DEMO_ARTIST = ARTIST;
