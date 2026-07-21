/**
 * In-memory Supabase stand-in for the AI staff dev harness.
 *
 * This sandbox blocks the live Supabase host for browser requests, so the real
 * `/studio/ai` surfaces can't hit it from a screenshot harness. This mock
 * implements just enough of the chainable PostgREST builder that
 * `api/agentActions.ts`, `api/agentSettings.ts`, `api/playbooks.ts`,
 * `role.ts` (`getCurrentProfile` / `getCurrentArtistProfile`) and the approval
 * wrapper use — select/insert/update/delete + eq/order/limit/maybeSingle/single
 * + head-count — so the REAL AiStaffView, ApprovalCard, ActivityFeed and
 * PlaybookEditor run end-to-end against seeded fixtures. Never imported outside
 * `/dev/*`.
 */
import type { InkdSupabaseClient } from "@inkd/core/supabase";

type Row = Record<string, unknown>;

function genId(): string {
  return `mock-${Math.random().toString(36).slice(2, 10)}`;
}

class MockBuilder
  implements PromiseLike<{ data: unknown; error: null; count?: number }>
{
  private filters: [string, unknown][] = [];
  private inFilters: [string, unknown[]][] = [];
  private gteFilters: [string, unknown][] = [];
  private lteFilters: [string, unknown][] = [];
  private mode: "select" | "insert" | "update" | "delete" = "select";
  private patch: Row | null = null;
  private inserted: Row[] = [];
  private countOnly = false;
  private orderCol: string | null = null;
  private orderAscending = true;
  private limitN: number | null = null;
  private rangeFrom: number | null = null;
  private rangeTo: number | null = null;
  private isSingle = false;

  constructor(
    private rows: Row[],
    private defaults: () => Row = () => ({}),
  ) {}

  select(_columns?: string, opts?: { count?: "exact"; head?: boolean }) {
    if (this.mode !== "insert" && this.mode !== "update" && this.mode !== "delete")
      this.mode = "select";
    if (opts?.count) this.countOnly = true;
    return this;
  }
  insert(row: Row | Row[]) {
    this.mode = "insert";
    const list = Array.isArray(row) ? row : [row];
    this.inserted = list.map((r) => ({
      id: genId(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...this.defaults(),
      ...r,
    }));
    for (const r of this.inserted) this.rows.push(r);
    return this;
  }
  update(patch: Row) {
    this.mode = "update";
    this.patch = patch;
    return this;
  }
  delete() {
    this.mode = "delete";
    return this;
  }
  eq(column: string, value: unknown) {
    this.filters.push([column, value]);
    return this;
  }
  in(column: string, values: unknown[]) {
    this.inFilters.push([column, values]);
    return this;
  }
  gte(column: string, value: unknown) {
    this.gteFilters.push([column, value]);
    return this;
  }
  lte(column: string, value: unknown) {
    this.lteFilters.push([column, value]);
    return this;
  }
  order(column: string, opts?: { ascending?: boolean }) {
    this.orderCol = column;
    this.orderAscending = opts?.ascending ?? true;
    return this;
  }
  limit(n: number) {
    this.limitN = n;
    return this;
  }
  range(from: number, to: number) {
    this.rangeFrom = from;
    this.rangeTo = to;
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

  private matched(): Row[] {
    return this.rows.filter(
      (row) =>
        this.filters.every(([k, v]) => row[k] === v) &&
        this.inFilters.every(([k, vs]) => vs.includes(row[k])) &&
        this.gteFilters.every(([k, v]) => (row[k] as never) >= (v as never)) &&
        this.lteFilters.every(([k, v]) => (row[k] as never) <= (v as never)),
    );
  }

  private execute(): { data: unknown; error: null; count?: number } {
    if (this.mode === "insert") {
      const data = this.isSingle ? (this.inserted[0] ?? null) : this.inserted;
      return { data, error: null };
    }
    if (this.mode === "update") {
      const matched = this.matched();
      for (const row of matched) Object.assign(row, this.patch, {
        updated_at: new Date().toISOString(),
      });
      const data = this.isSingle ? (matched[0] ?? null) : matched;
      return { data, error: null };
    }
    if (this.mode === "delete") {
      const matched = this.matched();
      for (const row of matched) {
        const idx = this.rows.indexOf(row);
        if (idx >= 0) this.rows.splice(idx, 1);
      }
      return { data: null, error: null };
    }

    let matched = this.matched();
    if (this.countOnly) return { data: null, error: null, count: matched.length };
    if (this.orderCol) {
      const col = this.orderCol;
      matched = [...matched].sort((a, b) => {
        const av = String(a[col] ?? "");
        const bv = String(b[col] ?? "");
        if (av === bv) return 0;
        const cmp = av < bv ? -1 : 1;
        return this.orderAscending ? cmp : -cmp;
      });
    }
    if (this.rangeFrom != null && this.rangeTo != null)
      matched = matched.slice(this.rangeFrom, this.rangeTo + 1);
    if (this.limitN != null) matched = matched.slice(0, this.limitN);
    if (this.isSingle) return { data: matched[0] ?? null, error: null };
    return { data: matched, error: null };
  }

  then<TResult1 = { data: unknown; error: null; count?: number }, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: unknown; error: null; count?: number }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }
}

function stubChannel() {
  const channel = {
    on() {
      return channel;
    },
    subscribe() {
      return channel;
    },
  };
  return channel;
}

export interface AiStaffSeed {
  profileId: string;
  profile: Row;
  artistProfile: Row;
  agentSettings: Row;
  agentActions: Row[];
  playbooks: Row[];
  messages: Row[];
  /** Optional dashboard fixtures so DashboardPreview renders in the harness. */
  bookingRequests?: Row[];
  sessions?: Row[];
  payments?: Row[];
  bookings?: Row[];
}

export function createMockAiStaffClient(seed: AiStaffSeed): InkdSupabaseClient {
  const tables: Record<string, Row[]> = {
    profiles: [seed.profile],
    artist_profiles: [seed.artistProfile],
    agent_settings: [seed.agentSettings],
    agent_actions: seed.agentActions.map((r) => ({ ...r })),
    agent_playbooks: seed.playbooks.map((r) => ({ ...r })),
    messages: seed.messages.map((r) => ({ ...r })),
    threads: [],
    booking_requests: (seed.bookingRequests ?? []).map((r) => ({ ...r })),
    sessions: (seed.sessions ?? []).map((r) => ({ ...r })),
    payments: (seed.payments ?? []).map((r) => ({ ...r })),
    bookings: (seed.bookings ?? []).map((r) => ({ ...r })),
  };

  const client = {
    auth: {
      async getUser() {
        return { data: { user: { id: seed.profileId } }, error: null };
      },
    },
    from(table: string) {
      const rows = tables[table];
      if (!rows) throw new Error(`mock ai-staff client: unsupported table "${table}"`);
      return new MockBuilder(rows, () =>
        table === "agent_actions"
          ? { status: "proposed", data_consulted: [], payload: {}, tier: 1 }
          : {},
      );
    },
    channel() {
      return stubChannel();
    },
    removeChannel() {
      /* no-op */
    },
  };

  return client as unknown as InkdSupabaseClient;
}
