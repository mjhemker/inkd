"use client";

/**
 * Dev-only preview harness for the REAL `NotificationPreferencesPanel`
 * (Settings > Notifications), rendered against an in-memory mock Supabase client
 * because this sandbox's egress blocks the live project for browser requests.
 * Never linked from product nav; not for production.
 */
import { InkdProvider } from "@inkd/core/hooks";
import type { InkdSupabaseClient } from "@inkd/core/supabase";
import { NotificationPreferencesPanel } from "@/components/notifications/notification-preferences";

const PROFILE_ID = "demo-profile-jayden";

type Row = Record<string, unknown>;

// A handful of stored overrides; every other category falls back to defaults
// via resolveEffectivePreferences, so the grid shows a realistic mix.
const STORED_PREFS: Row[] = [
  { user_id: PROFILE_ID, category: "message", in_app: true, push: true, email: false },
  { user_id: PROFILE_ID, category: "review", in_app: true, push: false, email: false },
  { user_id: PROFILE_ID, category: "deposit", in_app: true, push: true, email: true },
];

class MockBuilder implements PromiseLike<{ data: unknown; error: null }> {
  private filters: [string, unknown][] = [];
  private single = false;
  constructor(private rows: Row[]) {}
  select() {
    return this;
  }
  upsert() {
    return this;
  }
  eq(c: string, v: unknown) {
    this.filters.push([c, v]);
    return this;
  }
  maybeSingle() {
    this.single = true;
    return this;
  }
  private matched() {
    return this.rows.filter((r) => this.filters.every(([k, v]) => r[k] === v));
  }
  then<T1 = { data: unknown; error: null }, T2 = never>(
    onf?: ((v: { data: unknown; error: null }) => T1 | PromiseLike<T1>) | null,
    onr?: ((r: unknown) => T2 | PromiseLike<T2>) | null,
  ): PromiseLike<T1 | T2> {
    const m = this.matched();
    const data = this.single ? (m[0] ?? null) : m;
    return Promise.resolve({ data, error: null }).then(onf, onr);
  }
}

const PROFILE: Row = {
  id: PROFILE_ID,
  handle: "jayden.ink",
  display_name: "Jayden Cole",
  email: "jayden@inkd.test",
  is_artist: true,
  is_public: true,
  created_at: new Date("2026-01-01").toISOString(),
  updated_at: new Date("2026-01-01").toISOString(),
};

const mockClient = {
  auth: {
    async getUser() {
      return { data: { user: { id: PROFILE_ID } }, error: null };
    },
  },
  from(table: string) {
    if (table === "profiles") return new MockBuilder([PROFILE]);
    if (table === "notification_preferences") return new MockBuilder(STORED_PREFS);
    throw new Error(`mock prefs client: unsupported table "${table}"`);
  },
  channel() {
    const ch = { on: () => ch, subscribe: () => ch };
    return ch;
  },
  removeChannel() {},
} as unknown as InkdSupabaseClient;

export default function NotificationPrefsPreviewPage() {
  return (
    <InkdProvider client={mockClient}>
      <div className="min-h-dvh bg-surface-base text-content-primary">
        <main className="mx-auto w-full max-w-3xl px-6 py-10">
          <NotificationPreferencesPanel />
        </main>
      </div>
    </InkdProvider>
  );
}
