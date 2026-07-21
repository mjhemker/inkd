/**
 * In-memory fake Supabase client for the OFFLINE Instagram preview harness
 * (this env's egress to Supabase is policy-blocked). Not used in the app;
 * screenshot/QA aid only.
 *
 * Intercepts `functions.invoke` for the REAL deployed endpoints:
 *   instagram-status · instagram-oauth-start · instagram-media-list ·
 *   instagram-import · instagram-disconnect
 * and models the error contract (503 coming-soon, 409 token-expired) as a
 * Supabase FunctionsHttpError with a `context` Response the core error mapper
 * reads.
 */
import type { InkdSupabaseClient } from "@inkd/core";

const now = new Date();
const iso = (minsAgo: number) => new Date(now.getTime() - minsAgo * 60_000).toISOString();

export type InstagramScenario =
  | "not-connected"
  | "connected"
  | "token-expired"
  | "coming-soon";

const USER = { id: "demo-ig-user", email: "ig-demo@inkd.test" };

// A tiny inline SVG data URL so tiles render a real image offline (no network).
function swatch(hue: number): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><rect width='300' height='300' fill='hsl(${hue} 45% 22%)'/><circle cx='150' cy='150' r='90' fill='hsl(${hue} 55% 42%)'/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

interface MediaItem {
  id: string;
  caption: string | null;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM" | null;
  permalink: string | null;
  timestamp: string | null;
  preview_url: string | null;
  child_count: number;
  importable: boolean;
  already_imported: boolean;
}

function makeItem(i: number): MediaItem {
  const kind = i % 5;
  const media_type =
    kind === 0 ? "CAROUSEL_ALBUM" : kind === 1 ? "VIDEO" : "IMAGE";
  const unimportable = i === 3; // one copyright-flagged
  const alreadyImported = i === 1 || i === 6; // a couple already in portfolio
  const broken = i === 8; // one with a dead preview URL → caption fallback
  return {
    id: `media-${i}`,
    caption:
      i % 3 === 0
        ? `Fine-line piece ${i} — healed, 3 weeks. Booking custom work this fall.`
        : i % 3 === 1
          ? `Blackwork sleeve session ${i}`
          : null,
    media_type,
    permalink: `https://www.instagram.com/p/demo${i}/`,
    timestamp: iso(i * 120),
    preview_url: broken ? "https://invalid.example/broken.jpg" : swatch((i * 37) % 360),
    child_count: media_type === "CAROUSEL_ALBUM" ? ((i % 6) + 2) : 0,
    importable: !unimportable,
    already_imported: alreadyImported,
  };
}

const PAGE_1: MediaItem[] = Array.from({ length: 12 }, (_, i) => makeItem(i));
const PAGE_2: MediaItem[] = Array.from({ length: 8 }, (_, i) => makeItem(i + 12));

function statusPayload(scenario: InstagramScenario) {
  if (scenario === "connected") {
    return {
      connected: true,
      ig_username: "hemkerart",
      connected_at: iso(60 * 24 * 3),
      last_synced_at: iso(140),
      token_expired: false,
    };
  }
  if (scenario === "token-expired") {
    return {
      connected: true,
      ig_username: "hemkerart",
      connected_at: iso(60 * 24 * 70),
      last_synced_at: iso(60 * 24 * 40),
      token_expired: true,
    };
  }
  // not-connected
  return {
    connected: false,
    ig_username: null,
    connected_at: null,
    last_synced_at: null,
    token_expired: false,
  };
}

function httpError(status: number, code: string, message: string) {
  return {
    data: null,
    error: {
      name: "FunctionsHttpError",
      message,
      context: {
        status,
        json: async () => ({ error: code, message }),
      },
    },
  };
}

export function createFakeInstagramClient(scenario: InstagramScenario): InkdSupabaseClient {
  const invoke = async (name: string, opts?: { body?: Record<string, unknown> }) => {
    if (scenario === "coming-soon") {
      return httpError(503, "instagram_not_configured", "Instagram import isn't available yet.");
    }

    switch (name) {
      case "instagram-status":
        return { data: statusPayload(scenario), error: null };

      case "instagram-oauth-start":
        return {
          data: { url: "https://www.instagram.com/oauth/authorize?client_id=demo&scenario=" + scenario },
          error: null,
        };

      case "instagram-media-list": {
        if (scenario === "token-expired") {
          return httpError(409, "conflict", "Instagram token expired — reconnect required");
        }
        const after = opts?.body?.after as string | undefined;
        if (after === "cursor-2") return { data: { items: PAGE_2, next_cursor: null }, error: null };
        return { data: { items: PAGE_1, next_cursor: "cursor-2" }, error: null };
      }

      case "instagram-import": {
        const ids = (opts?.body?.media_ids as string[]) ?? [];
        // Model a couple already-imported + one skipped out of the selection.
        const already = ids.filter((id) => id === "media-1" || id === "media-6").length;
        const skipped = ids.includes("media-3") ? 1 : 0;
        const created = Math.max(0, ids.length - already - skipped);
        return {
          data: {
            run: {
              id: "run-preview",
              artist_id: "demo-ig-artist",
              status: "completed",
              media_seen: ids.length,
              posts_created: created,
              pieces_created: created,
              media_skipped: skipped,
              already_imported: already,
              error_message: null,
              started_at: iso(1),
              completed_at: now.toISOString(),
              created_at: now.toISOString(),
            },
          },
          error: null,
        };
      }

      case "instagram-disconnect":
        return { data: { ok: true, disconnected: true }, error: null };

      default:
        return { data: null, error: null };
    }
  };

  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    limit: () => builder,
    not: () => builder,
    maybeSingle: async () => ({ data: null, error: null }),
    single: async () => ({ data: null, error: null }),
    then: (onF: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(onF),
  };

  const client = {
    from: () => builder,
    functions: { invoke },
    auth: {
      getUser: async () => ({ data: { user: USER }, error: null }),
      getSession: async () => ({ data: { session: { user: USER } }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signOut: async () => ({ error: null }),
    },
  };
  return client as unknown as InkdSupabaseClient;
}
