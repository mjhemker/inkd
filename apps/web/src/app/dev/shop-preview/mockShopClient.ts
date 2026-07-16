/**
 * Minimal in-memory Supabase-shaped client for the shop dashboard screenshot
 * harness. The sandbox blocks egress to the live Supabase host for browser
 * requests, so the hook-driven `ShopDashboardView` can't reach it — this mock
 * answers the exact read calls its roster tab makes (getCurrentProfile /
 * getCurrentArtistProfile / getShopByOwnerArtistId / listShopRoster) from
 * seeded rows. Mirrors ../ai-staff-preview/mockAiStaffClient.ts. Never used in
 * production.
 */
import type { InkdSupabaseClient } from "@inkd/core/supabase";

type Row = Record<string, unknown>;

class MockBuilder {
  private filters: [string, unknown][] = [];
  private orderCol: string | null = null;
  private orderAsc = true;
  private isSingle = false;

  constructor(private rows: Row[]) {}

  select() {
    return this;
  }
  eq(column: string, value: unknown) {
    this.filters.push([column, value]);
    return this;
  }
  order(column: string, opts?: { ascending?: boolean }) {
    this.orderCol = column;
    this.orderAsc = opts?.ascending ?? true;
    return this;
  }
  maybeSingle() {
    this.isSingle = true;
    return this;
  }
  single() {
    this.isSingle = true;
    return this;
  }

  private execute() {
    let matched = this.rows.filter((r) =>
      this.filters.every(([k, v]) => r[k] === v),
    );
    if (this.orderCol) {
      const col = this.orderCol;
      matched = [...matched].sort((a, b) => {
        const av = a[col] as string | number;
        const bv = b[col] as string | number;
        if (av === bv) return 0;
        const cmp = av < bv ? -1 : 1;
        return this.orderAsc ? cmp : -cmp;
      });
    }
    if (this.isSingle) return { data: matched[0] ?? null, error: null };
    return { data: matched, error: null };
  }

  then<T1 = unknown, T2 = never>(
    onfulfilled?: ((v: { data: unknown; error: null }) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
  ) {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }
}

export interface ShopMockSeed {
  userId: string;
  profiles: Row[];
  artist_profiles: Row[];
  shops: Row[];
  shop_members: Row[];
  studio_locations?: Row[];
  agenda?: Row[];
}

export function createMockShopClient(seed: ShopMockSeed): InkdSupabaseClient {
  const tables: Record<string, Row[]> = {
    profiles: seed.profiles,
    artist_profiles: seed.artist_profiles,
    shops: seed.shops,
    shop_members: seed.shop_members,
    studio_locations: seed.studio_locations ?? [],
  };
  const client = {
    auth: {
      async getUser() {
        return { data: { user: { id: seed.userId } }, error: null };
      },
    },
    from(table: string) {
      return new MockBuilder(tables[table] ?? []);
    },
    async rpc(name: string) {
      if (name === "shop_managed_member_agenda") {
        return { data: seed.agenda ?? [], error: null };
      }
      return { data: [], error: null };
    },
    channel() {
      const ch = { on: () => ch, subscribe: () => ch };
      return ch;
    },
    removeChannel() {},
  };
  return client as unknown as InkdSupabaseClient;
}
