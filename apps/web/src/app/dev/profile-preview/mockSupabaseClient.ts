/**
 * In-memory Supabase client stand-in — dev-only preview harness.
 *
 * This sandbox's egress policy blocks the live Supabase project
 * (khlpidflnvkqafkvkpfy.supabase.co) for outbound browser/SSR requests, so the
 * real `/profile` screen can't be screenshotted against live data here. This
 * mock implements just enough of the `SupabaseClient` surface (`.from().select()
 * .eq().order().range().insert().update().delete().upsert().single()
 * .maybeSingle()`, `.auth.getUser()`, `.storage.from().upload()/.getPublicUrl()`)
 * to drive the REAL `/profile` page component and its hooks with realistic
 * seed data, entirely client-side. Never imported outside `/dev/*`.
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
    this.tables.set(table, [...rows]);
  }

  get(table: string): Row[] {
    return this.tables.get(table) ?? [];
  }

  insert(table: string, row: Row): Row {
    const withId: Row = { id: randomId(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), sort_order: 0, ...row };
    const rows = this.tables.get(table) ?? [];
    rows.push(withId);
    this.tables.set(table, rows);
    return withId;
  }

  update(table: string, filters: [string, unknown][], patch: Row): Row[] {
    const rows = this.tables.get(table) ?? [];
    const updated: Row[] = [];
    for (const row of rows) {
      if (filters.every(([col, val]) => row[col] === val)) {
        Object.assign(row, patch, { updated_at: new Date().toISOString() });
        updated.push(row);
      }
    }
    return updated;
  }

  upsert(table: string, row: Row, conflictCol = "id"): Row {
    const rows = this.tables.get(table) ?? [];
    const key = row[conflictCol];
    const existing = rows.find((r) => r[conflictCol] === key);
    if (existing) {
      Object.assign(existing, row, { updated_at: new Date().toISOString() });
      return existing;
    }
    return this.insert(table, row);
  }

  delete(table: string, filters: [string, unknown][]) {
    const rows = this.tables.get(table) ?? [];
    this.tables.set(
      table,
      rows.filter((row) => !filters.every(([col, val]) => row[col] === val)),
    );
  }
}

class MockBuilder implements PromiseLike<{ data: unknown; error: null }> {
  private filters: [string, unknown][] = [];
  private op: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  private payload: Row | Row[] | undefined;
  private wantSingle = false;
  private wantMaybeSingle = false;
  private selectStr = "*";

  constructor(
    private db: MockDb,
    private table: string,
  ) {}

  select(columns?: string) {
    if (columns) this.selectStr = columns;
    return this;
  }
  eq(col: string, val: unknown) {
    this.filters.push([col, val]);
    return this;
  }
  ilike(col: string, val: unknown) {
    this.filters.push([col, String(val).replace(/%/g, "")]);
    return this;
  }
  order() {
    return this;
  }
  range() {
    return this;
  }
  in(col: string, vals: unknown[]) {
    this.filters.push([`__in__${col}`, vals]);
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
  upsert(row: Row) {
    this.op = "upsert";
    this.payload = row;
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
    onfulfilled?: ((value: { data: unknown; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private matches(row: Row): boolean {
    return this.filters.every(([col, val]) => {
      if (col.startsWith("__in__")) {
        const realCol = col.slice(6);
        return Array.isArray(val) && val.includes(row[realCol]);
      }
      return row[col] === val;
    });
  }

  /** Minimal embedded-relation support for `select("col, relation(*)")`
   * shapes — the only pattern used in `@inkd/core`'s api layer is
   * `artist_styles.select("style_id, styles(*)")`, resolved here by
   * convention (`${singular(relation)}_id` foreign key on the source row). */
  private embed(row: Row): Row {
    const match = /(\w+)\(\*\)/.exec(this.selectStr);
    if (!match) return row;
    const relation = match[1]!;
    const singular = relation.endsWith("s") ? relation.slice(0, -1) : relation;
    const fkCol = `${singular}_id`;
    const fkVal = row[fkCol];
    const related = this.db.get(relation).find((r) => r.id === fkVal) ?? null;
    return { ...row, [relation]: related };
  }

  private async execute(): Promise<{ data: unknown; error: null }> {
    if (this.op === "select") {
      const filtered = this.db.get(this.table).filter((r) => this.matches(r)).map((r) => this.embed(r));
      if (this.wantSingle) return { data: filtered[0] ?? null, error: null };
      if (this.wantMaybeSingle) return { data: filtered[0] ?? null, error: null };
      return { data: filtered, error: null };
    }
    if (this.op === "insert") {
      const toInsert = Array.isArray(this.payload) ? this.payload : [this.payload as Row];
      const inserted = toInsert.map((row) => this.db.insert(this.table, row));
      return { data: this.wantSingle || this.wantMaybeSingle ? inserted[0] : inserted, error: null };
    }
    if (this.op === "update") {
      const updated = this.db.update(this.table, this.filters, this.payload as Row);
      return { data: this.wantSingle || this.wantMaybeSingle ? (updated[0] ?? null) : updated, error: null };
    }
    if (this.op === "upsert") {
      const row = this.db.upsert(this.table, this.payload as Row, "artist_id" in (this.payload as Row) ? "artist_id" : "id");
      return { data: row, error: null };
    }
    if (this.op === "delete") {
      this.db.delete(this.table, this.filters);
      return { data: null, error: null };
    }
    return { data: null, error: null };
  }
}

export interface MockSeed {
  userId: string;
  email: string;
  tables: Record<string, Row[]>;
}

/** Builds a mock client that structurally satisfies `InkdSupabaseClient` for
 * the query shapes `@inkd/core`'s api layer uses. Not a real PostgREST client
 * — dev preview only. */
export function createMockSupabaseClient(seed: MockSeed): InkdSupabaseClient {
  const db = new MockDb();
  for (const [table, rows] of Object.entries(seed.tables)) {
    db.seed(table, rows);
  }

  const mockUser = { id: seed.userId, email: seed.email } as unknown;

  const client = {
    from(table: string) {
      return new MockBuilder(db, table);
    },
    auth: {
      async getUser() {
        return { data: { user: mockUser }, error: null };
      },
      async getSession() {
        return { data: { session: { user: mockUser } }, error: null };
      },
    },
    storage: {
      from() {
        return {
          async upload(path: string, fileBody: Blob) {
            void path;
            void fileBody;
            return { data: { path }, error: null };
          },
          getPublicUrl(path: string) {
            // Real uploads already resolve their preview from a local
            // object URL before this ever runs (ImageUploadField sets
            // `previewUrl` synchronously on file select), so the exact
            // string here only needs to be a stable placeholder.
            return { data: { publicUrl: `mock://media/${path}` } };
          },
        };
      },
    },
  };

  return client as unknown as InkdSupabaseClient;
}
