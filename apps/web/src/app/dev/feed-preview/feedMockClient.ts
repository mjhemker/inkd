/**
 * In-memory Supabase stand-in for the offline FEED preview harness.
 *
 * Richer than the profile-preview mock: the feed's data layer relies on real
 * `.order()` + `.range()` (deterministic newest-first pagination), `.in()`
 * batching, and `.upsert(..., { onConflict })` (like/save/follow toggles). This
 * mock implements those faithfully so the REAL feed components + `@inkd/core`
 * hooks behave exactly as they would live — this sandbox blocks egress to the
 * Supabase host, so it's the only way to render/screenshot the feed here.
 *
 * Never imported outside `/dev/*`.
 */
import type { InkdSupabaseClient } from "@inkd/core/supabase";

type Row = Record<string, unknown>;

function randomId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

class MockDb {
  private tables = new Map<string, Row[]>();

  seed(table: string, rows: Row[]) {
    this.tables.set(table, rows.map((r) => ({ ...r })));
  }
  get(table: string): Row[] {
    return this.tables.get(table) ?? [];
  }
  set(table: string, rows: Row[]) {
    this.tables.set(table, rows);
  }
}

interface OrderSpec {
  col: string;
  ascending: boolean;
}

class MockBuilder implements PromiseLike<{ data: unknown; error: null }> {
  private filters: Array<{ kind: "eq" | "in"; col: string; val: unknown }> = [];
  private op: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  private payload: Row | Row[] | undefined;
  private onConflict: string[] = ["id"];
  private wantSingle = false;
  private wantMaybeSingle = false;
  private orderSpec: OrderSpec | null = null;
  private rangeSpec: { from: number; to: number } | null = null;

  constructor(
    private db: MockDb,
    private table: string,
  ) {}

  select() {
    return this;
  }
  eq(col: string, val: unknown) {
    this.filters.push({ kind: "eq", col, val });
    return this;
  }
  in(col: string, vals: unknown[]) {
    this.filters.push({ kind: "in", col, val: vals });
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orderSpec = { col, ascending: opts?.ascending ?? true };
    return this;
  }
  range(from: number, to: number) {
    this.rangeSpec = { from, to };
    return this;
  }
  insert(row: Row | Row[]) {
    this.op = "insert";
    this.payload = row;
    return this;
  }
  update(patch: Row) {
    this.op = "update";
    this.payload = patch;
    return this;
  }
  upsert(row: Row | Row[], opts?: { onConflict?: string }) {
    this.op = "upsert";
    this.payload = row;
    if (opts?.onConflict) this.onConflict = opts.onConflict.split(",").map((c) => c.trim());
    return this;
  }
  delete() {
    this.op = "delete";
    return this;
  }
  maybeSingle() {
    this.wantMaybeSingle = true;
    return this.execute();
  }
  single() {
    this.wantSingle = true;
    return this.execute();
  }

  then<TResult1 = { data: unknown; error: null }, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: unknown; error: null }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private matches(row: Row): boolean {
    return this.filters.every((f) =>
      f.kind === "in"
        ? Array.isArray(f.val) && f.val.includes(row[f.col])
        : row[f.col] === f.val,
    );
  }

  private conflictKey(row: Row): string {
    return this.onConflict.map((c) => String(row[c])).join("|");
  }

  private async execute(): Promise<{ data: unknown; error: null }> {
    if (this.op === "select") {
      let rows = this.db.get(this.table).filter((r) => this.matches(r));
      if (this.orderSpec) {
        const { col, ascending } = this.orderSpec;
        rows = [...rows].sort((a, b) => {
          const av = a[col];
          const bv = b[col];
          const cmp = av === bv ? 0 : (av as number | string) < (bv as number | string) ? -1 : 1;
          return ascending ? cmp : -cmp;
        });
      }
      if (this.rangeSpec) rows = rows.slice(this.rangeSpec.from, this.rangeSpec.to + 1);
      if (this.wantSingle || this.wantMaybeSingle) return { data: rows[0] ?? null, error: null };
      return { data: rows, error: null };
    }
    if (this.op === "insert") {
      const toInsert = Array.isArray(this.payload) ? this.payload : [this.payload as Row];
      const rows = this.db.get(this.table);
      const inserted = toInsert.map((r) => {
        const withId: Row = { id: randomId(), created_at: new Date().toISOString(), ...r };
        rows.push(withId);
        return withId;
      });
      this.db.set(this.table, rows);
      return { data: this.wantSingle || this.wantMaybeSingle ? inserted[0] : inserted, error: null };
    }
    if (this.op === "upsert") {
      const toUpsert = Array.isArray(this.payload) ? this.payload : [this.payload as Row];
      const rows = this.db.get(this.table);
      for (const r of toUpsert) {
        const key = this.conflictKey(r);
        const existing = rows.find((row) => this.conflictKey(row) === key);
        if (existing) Object.assign(existing, r);
        else rows.push({ id: randomId(), created_at: new Date().toISOString(), ...r });
      }
      this.db.set(this.table, rows);
      return { data: toUpsert, error: null };
    }
    if (this.op === "update") {
      const rows = this.db.get(this.table);
      const updated: Row[] = [];
      for (const row of rows) {
        if (this.matches(row)) {
          Object.assign(row, this.payload as Row);
          updated.push(row);
        }
      }
      return { data: this.wantSingle || this.wantMaybeSingle ? (updated[0] ?? null) : updated, error: null };
    }
    if (this.op === "delete") {
      this.db.set(
        this.table,
        this.db.get(this.table).filter((r) => !this.matches(r)),
      );
      return { data: null, error: null };
    }
    return { data: null, error: null };
  }
}

export interface FeedMockSeed {
  viewerId: string | null;
  email: string;
  tables: Record<string, Row[]>;
}

export function createFeedMockClient(seed: FeedMockSeed): InkdSupabaseClient {
  const db = new MockDb();
  for (const [table, rows] of Object.entries(seed.tables)) db.seed(table, rows);

  const user = seed.viewerId ? { id: seed.viewerId, email: seed.email } : null;

  const client = {
    from(table: string) {
      return new MockBuilder(db, table);
    },
    // Minimal RPC shim for the feed filter panel. `feed_filter_artist_ids`
    // returns the seeded published-artist ids (optionally narrowed by the
    // books-open flag) so applying a filter in the preview doesn't crash and
    // still shows a populated wall. Real narrowing is proven against the live DB.
    async rpc(fn: string, args?: Record<string, unknown>) {
      if (fn === "feed_filter_artist_ids") {
        const booksOpen = args?.p_books_open === true;
        const ids = db
          .get("artist_profiles")
          .filter((ap) => !booksOpen || ap.accepts_new_clients === true)
          .map((ap) => ap.id as string);
        return { data: ids, error: null };
      }
      return { data: [], error: null };
    },
    auth: {
      async getUser() {
        return { data: { user }, error: null };
      },
      async getSession() {
        return { data: { session: user ? { user } : null }, error: null };
      },
    },
  };

  return client as unknown as InkdSupabaseClient;
}
