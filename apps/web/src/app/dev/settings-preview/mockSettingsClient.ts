/**
 * In-memory Supabase stand-in for the Settings dev harness.
 *
 * This sandbox's egress policy blocks the live Supabase project
 * (khlpidflnvkqafkvkpfy.supabase.co) for outbound browser requests, so the
 * real `/settings` screen can't be screenshotted against live data here (see
 * `dev/profile-preview/mockSupabaseClient.ts` for the same note). This mock
 * implements just enough of the chainable PostgREST builder — select/eq/
 * order/range/limit/single/maybeSingle/insert/update/delete + head-count —
 * for `getCurrentProfile`, `getCurrentArtistProfile`, `useStyles`,
 * `usePortfolioPieces`/`usePortfolioMutations`, and the dashboard stats
 * queries (`api/dashboardStats.ts`) to run the REAL `SettingsView` /
 * `DashboardPreview` components end to end against seeded fixtures.
 *
 * `storage.from().upload()/.getPublicUrl()` return synchronously so the avatar
 * upload flow can be exercised for the preview states screenshot — the real
 * fix (local object-URL / file-URI preview shown immediately) doesn't depend
 * on the mock's timing, but we add an artificial delay so the "uploading"
 * state is actually visible to a screenshot script.
 *
 * Never imported outside `/dev/*`.
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
  private mode: "select" | "insert" | "update" | "delete" = "select";
  private patch: Row | null = null;
  private inserted: Row[] = [];
  private countOnly = false;
  private orderCol: string | null = null;
  private orderAscending = true;
  private limitN: number | null = null;
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
  ilike(column: string, value: unknown) {
    this.filters.push([`__ilike__${column}`, String(value).replace(/%/g, "").toLowerCase()]);
    return this;
  }
  in(column: string, values: unknown[]) {
    this.filters.push([`__in__${column}`, values]);
    return this;
  }
  gte(column: string, value: unknown) {
    this.filters.push([`__gte__${column}`, value]);
    return this;
  }
  lte(column: string, value: unknown) {
    this.filters.push([`__lte__${column}`, value]);
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
  range() {
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
    return this.rows.filter((row) =>
      this.filters.every(([k, v]) => {
        if (k.startsWith("__ilike__")) {
          const col = k.slice(9);
          return String(row[col] ?? "").toLowerCase().includes(v as string);
        }
        if (k.startsWith("__in__")) {
          const col = k.slice(6);
          return Array.isArray(v) && v.includes(row[col]);
        }
        if (k.startsWith("__gte__")) {
          const col = k.slice(7);
          return String(row[col] ?? "") >= String(v);
        }
        if (k.startsWith("__lte__")) {
          const col = k.slice(7);
          return String(row[col] ?? "") <= String(v);
        }
        return row[k] === v;
      }),
    );
  }

  private execute(): { data: unknown; error: null; count?: number } {
    if (this.mode === "insert") {
      const data = this.isSingle ? (this.inserted[0] ?? null) : this.inserted;
      return { data, error: null };
    }
    if (this.mode === "update") {
      const matched = this.matched();
      for (const row of matched)
        Object.assign(row, this.patch, { updated_at: new Date().toISOString() });
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
        const av = a[col];
        const bv = b[col];
        const cmp = av === bv ? 0 : (av as number | string) < (bv as number | string) ? -1 : 1;
        return this.orderAscending ? cmp : -cmp;
      });
    }
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

export interface SettingsSeed {
  profileId: string;
  tables: Record<string, Row[]>;
}

/** Builds a mock client that structurally satisfies `InkdSupabaseClient` for
 * the query shapes `SettingsView` + `DashboardPreview` need. Not a real
 * PostgREST client — dev preview only. */
export function createMockSettingsClient(seed: SettingsSeed): InkdSupabaseClient {
  const tables: Record<string, Row[]> = {};
  for (const [name, rows] of Object.entries(seed.tables)) {
    tables[name] = rows.map((r) => ({ ...r }));
  }

  const client = {
    auth: {
      async getUser() {
        return { data: { user: { id: seed.profileId } }, error: null };
      },
    },
    from(table: string) {
      if (!tables[table]) tables[table] = [];
      return new MockBuilder(tables[table]!, () => ({}));
    },
    storage: {
      from() {
        return {
          async upload(path: string, _fileBody: unknown) {
            // Artificial delay so the "uploading" preview state (immediate
            // local object-URL / file-URI, before this resolves) is actually
            // observable in a screenshot script.
            await new Promise((r) => setTimeout(r, 1200));
            return { data: { path }, error: null };
          },
          getPublicUrl(_path: string) {
            // A real, inline-loadable image (a solid violet square) instead
            // of an external URL — this sandbox blocks outbound image hosts,
            // and the preview screenshots need the "uploaded" state to
            // actually render so all three avatar states are visible.
            const VIOLET_SQUARE_PNG_BASE64 =
              "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAeUlEQVR4nO3PwQkAIBDAsNvfQdzRl0P4CEKhA6Sz1/m64YIGtKABLWhACxrQgga0oAEtaEALGtCCBrSgAS1oQAsa0IIGtKABLWhACxrQgga0oAEtaEALGtCCBrSgAS1oQAsa0IIGtKABLWhACxrQgga0oAEtaEALHrsh/MH/SPcVvQAAAABJRU5ErkJggg==";
            return {
              data: {
                publicUrl: `data:image/png;base64,${VIOLET_SQUARE_PNG_BASE64}`,
              },
            };
          },
        };
      },
    },
    channel() {
      return { on: () => ({ subscribe: () => {} }), subscribe: () => {} };
    },
    removeChannel() {
      /* no-op */
    },
  };

  return client as unknown as InkdSupabaseClient;
}
