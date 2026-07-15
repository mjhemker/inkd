/**
 * In-memory fake Supabase client for the offline onboarding/settings PREVIEW
 * harness only (this env's egress to Supabase is policy-blocked, so this lets us
 * render + screenshot the real screens without a network). Not used in the app.
 */
import type { InkdSupabaseClient } from "@inkd/core";

const now = new Date().toISOString();

const USER = { id: "demo-user", email: "onboard-demo@inkd.test" };

const PROFILE = {
  id: "demo-user",
  handle: "demo-onboard-jayden",
  display_name: "Demo Onboard",
  email: USER.email,
  avatar_url: null,
  bio: "Baltimore-based blackwork & fine line. Custom pieces and touch-ups.",
  is_artist: true,
  is_public: false,
  city: "Baltimore",
  state: "MD",
  phone: null,
  created_at: now,
  updated_at: now,
};

const ARTIST = {
  id: "demo-artist",
  profile_id: "demo-user",
  bio: "Baltimore-based blackwork & fine line. Custom pieces and touch-ups.",
  tagline: null,
  styles: ["blackwork", "fine-line"],
  classification: "shop_resident",
  travel_fly_out: true,
  travel_house_calls: false,
  travel_at_home: false,
  accepts_new_clients: true,
  years_experience: 6,
  instagram_handle: null,
  onboarding_step: 0,
  onboarding_completed_at: null,
  is_published: false,
  stripe_account_id: null,
  stripe_identity_verified: false,
  created_at: now,
  updated_at: now,
};

const STYLES = [
  { id: "s1", slug: "blackwork", name: "Blackwork", category: "black", description: null, sort_order: 1, created_at: now },
  { id: "s2", slug: "fine-line", name: "Fine line", category: "black", description: null, sort_order: 2, created_at: now },
  { id: "s3", slug: "traditional", name: "Traditional", category: "color", description: null, sort_order: 3, created_at: now },
  { id: "s4", slug: "japanese", name: "Japanese", category: "color", description: null, sort_order: 4, created_at: now },
  { id: "s5", slug: "lettering", name: "Lettering", category: "black", description: null, sort_order: 5, created_at: now },
  { id: "s6", slug: "realism", name: "Realism", category: "black", description: null, sort_order: 6, created_at: now },
];

const SERVICES = [
  {
    id: "svc1", artist_id: "demo-artist", location_id: null, name: "Consultation",
    description: "Talk through placement, size and references.", duration_minutes: 30,
    price_type: "fixed", price_cents: 0, deposit_type: "none", deposit_amount_cents: null,
    deposit_percent: null, break_time_minutes: 0, lead_time_hours: 24, is_public: true,
    video_conferencing: true, add_ons: [], calendar_ref: null, is_preset: true,
    preset_key: "consultation", sort_order: 0, created_at: now, updated_at: now,
  },
  {
    id: "svc2", artist_id: "demo-artist", location_id: null, name: "Full day",
    description: "A full day of work, roughly eight hours.", duration_minutes: 480,
    price_type: "fixed", price_cents: 120000, deposit_type: "fixed", deposit_amount_cents: 30000,
    deposit_percent: null, break_time_minutes: 15, lead_time_hours: 48, is_public: true,
    video_conferencing: false, add_ons: [], calendar_ref: null, is_preset: true,
    preset_key: "full_day", sort_order: 1, created_at: now, updated_at: now,
  },
];

function dataFor(table: string, single: boolean): unknown {
  switch (table) {
    case "profiles":
      return single ? PROFILE : [PROFILE];
    case "artist_profiles":
      return single ? ARTIST : [ARTIST];
    case "styles":
      return STYLES;
    case "services":
      return SERVICES;
    default:
      return single ? null : [];
  }
}

interface BuilderState {
  table: string;
  mutated: unknown;
  isDelete: boolean;
}

function makeBuilder(table: string) {
  const state: BuilderState = { table, mutated: undefined, isDelete: false };

  function resolve(kind: "list" | "single") {
    if (state.isDelete) return Promise.resolve({ data: null, error: null });
    if (state.mutated !== undefined) {
      const base = (dataFor(table, true) as Record<string, unknown>) ?? {};
      const merged = {
        ...base,
        ...(state.mutated as Record<string, unknown>),
        id: (base.id as string) ?? `demo-${table}`,
      };
      return Promise.resolve({
        data: kind === "list" ? [merged] : merged,
        error: null,
      });
    }
    const d = dataFor(table, kind === "single");
    return Promise.resolve({
      data: d,
      error: null,
      count: Array.isArray(d) ? d.length : 0,
    });
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
      state.mutated = Array.isArray(row) ? row[0] : row;
      return builder;
    },
    update: (row: unknown) => {
      state.mutated = row;
      return builder;
    },
    upsert: (row: unknown) => {
      state.mutated = Array.isArray(row) ? row[0] : row;
      return builder;
    },
    delete: () => {
      state.isDelete = true;
      return builder;
    },
    maybeSingle: () => resolve("single"),
    single: () => resolve("single"),
    then: (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) =>
      resolve("list").then(onF, onR),
  };
  return builder;
}

const storage = {
  from: () => ({
    upload: async () => ({ data: { path: "demo/path.jpg" }, error: null }),
    createSignedUrl: async () => ({
      data: { signedUrl: "https://example.com/demo.jpg" },
      error: null,
    }),
    remove: async () => ({ data: [], error: null }),
    getPublicUrl: () => ({ data: { publicUrl: "https://example.com/demo.jpg" } }),
  }),
};

export function createFakeClient(): InkdSupabaseClient {
  const client = {
    from: (table: string) => makeBuilder(table),
    storage,
    auth: {
      getUser: async () => ({ data: { user: USER }, error: null }),
      getSession: async () => ({ data: { session: { user: USER } }, error: null }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
      signOut: async () => ({ error: null }),
    },
  };
  return client as unknown as InkdSupabaseClient;
}
