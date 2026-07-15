/**
 * In-memory fake Supabase client for the offline Instagram/share-kit PREVIEW
 * harness only (this env's egress to Supabase is policy-blocked — see
 * dev/onboarding-preview/fake-client.ts for the established pattern this
 * mirrors). Not used in the app; screenshot/QA aid only.
 *
 * Adds `functions.invoke` interception on top of the onboarding harness's
 * table-query shim, so `ConnectedAccountsEditor` / `ShareKit` — which call
 * the instagram-oauth / instagram-import edge functions — render against
 * canned responses instead of a live network call.
 */
import type { InkdSupabaseClient } from "@inkd/core";

const now = new Date().toISOString();

const USER = { id: "demo-ig-user", email: "ig-demo@inkd.test" };

const PROFILE = {
  id: "demo-ig-user",
  handle: "jayden.ink",
  display_name: "Jayden Cole",
  email: USER.email,
  avatar_url: null,
  bio: "Baltimore-based blackwork & fine line. Booking custom pieces and touch-ups.",
  is_artist: true,
  is_public: true,
  city: "Baltimore",
  state: "MD",
  phone: null,
  created_at: now,
  updated_at: now,
};

const ARTIST = {
  id: "demo-ig-artist",
  profile_id: "demo-ig-user",
  bio: PROFILE.bio,
  tagline: "Blackwork & fine line",
  styles: ["blackwork", "fine-line"],
  classification: "shop_resident",
  travel_fly_out: true,
  travel_house_calls: false,
  travel_at_home: false,
  accepts_new_clients: true,
  years_experience: 6,
  instagram_handle: null,
  onboarding_step: 5,
  onboarding_completed_at: now,
  is_published: true,
  stripe_account_id: null,
  stripe_identity_verified: false,
  created_at: now,
  updated_at: now,
};

export type InstagramScenario = "not-configured" | "not-connected" | "connected";

const RUNS = [
  {
    id: "run-1",
    artist_id: "demo-ig-artist",
    status: "completed",
    media_seen: 24,
    posts_created: 6,
    pieces_created: 6,
    media_skipped: 0,
    already_imported: 18,
    error_message: null,
    started_at: now,
    completed_at: now,
    created_at: now,
  },
  {
    id: "run-2",
    artist_id: "demo-ig-artist",
    status: "completed",
    media_seen: 18,
    posts_created: 18,
    pieces_created: 18,
    media_skipped: 1,
    already_imported: 0,
    error_message: null,
    started_at: now,
    completed_at: now,
    created_at: now,
  },
];

function statusFor(scenario: InstagramScenario) {
  if (scenario === "not-configured") {
    return {
      configured: false,
      connected: false,
      ig_username: null,
      connected_at: null,
      token_expires_at: null,
      last_synced_at: null,
    };
  }
  if (scenario === "not-connected") {
    return {
      configured: true,
      connected: false,
      ig_username: null,
      connected_at: null,
      token_expires_at: null,
      last_synced_at: null,
    };
  }
  return {
    configured: true,
    connected: true,
    ig_username: "jayden.ink.tattoo",
    connected_at: now,
    token_expires_at: now,
    last_synced_at: now,
  };
}

function dataFor(table: string, single: boolean, scenario: InstagramScenario): unknown {
  switch (table) {
    case "profiles":
      return single ? PROFILE : [PROFILE];
    case "artist_profiles":
      return single ? ARTIST : [ARTIST];
    case "instagram_import_runs":
      return scenario === "connected" ? RUNS : [];
    default:
      return single ? null : [];
  }
}

function makeBuilder(table: string, scenario: InstagramScenario) {
  function resolve(kind: "list" | "single") {
    const d = dataFor(table, kind === "single", scenario);
    return Promise.resolve({ data: d, error: null });
  }
  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    limit: () => builder,
    not: () => builder,
    maybeSingle: () => resolve("single"),
    single: () => resolve("single"),
    then: (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) =>
      resolve("list").then(onF, onR),
  };
  return builder;
}

export function createFakeInstagramClient(scenario: InstagramScenario): InkdSupabaseClient {
  const client = {
    from: (table: string) => makeBuilder(table, scenario),
    functions: {
      invoke: async (name: string, opts?: { body?: Record<string, unknown> }) => {
        if (name === "instagram-oauth") {
          const action = opts?.body?.action ?? "status";
          if (action === "status") return { data: statusFor(scenario), error: null };
          if (action === "authorize-url") {
            return {
              data: { url: "https://www.instagram.com/oauth/authorize?client_id=demo" },
              error: null,
            };
          }
          if (action === "disconnect") return { data: { ok: true }, error: null };
        }
        if (name === "instagram-import") {
          return {
            data: {
              run_id: "run-preview",
              status: "completed",
              mediaSeen: 6,
              postsCreated: 6,
              piecesCreated: 6,
              mediaSkipped: 0,
              alreadyImported: 0,
            },
            error: null,
          };
        }
        return { data: null, error: null };
      },
    },
    auth: {
      getUser: async () => ({ data: { user: USER }, error: null }),
      getSession: async () => ({ data: { session: { user: USER } }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signOut: async () => ({ error: null }),
    },
  };
  return client as unknown as InkdSupabaseClient;
}

export { PROFILE, ARTIST };
