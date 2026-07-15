/**
 * In-memory Supabase client stand-in for the notifications dev harness.
 *
 * This sandbox's egress policy blocks the live Supabase project
 * (khlpidflnvkqafkvkpfy.supabase.co) for outbound browser requests, so the
 * real bell/dropdown/`/notifications` page can't be exercised against it from
 * a screenshot harness here. This mock implements just enough of the
 * chainable `.from(table).select().eq().order().range()` / `.update().eq()`
 * surface that `notifications.ts` + `role.ts` (`getCurrentProfile`) call —
 * enough to drive the REAL `NotificationBell` and `NotificationsHub`
 * components end-to-end against seeded fixture data, so their loading /
 * empty / read / unread code paths all actually run.
 *
 * Never imported outside `/dev/*`.
 */
import type { InkdSupabaseClient } from "@inkd/core/supabase";

type Row = Record<string, unknown>;

function matches(row: Row, filters: [string, unknown][]): boolean {
  return filters.every(([key, value]) => row[key] === value);
}

/**
 * Minimal stand-in for a PostgREST query builder: chainable (`select`,
 * `eq`, `order`, `range`, `update`, `maybeSingle`) and awaitable (`then`),
 * matching how the real `@supabase/supabase-js` builder is used at call
 * sites — `await client.from(t).select(...).eq(...).order(...).range(...)`.
 */
class MockQueryBuilder implements PromiseLike<{ data: unknown; error: null; count?: number }> {
  private filters: [string, unknown][] = [];
  private mode: "select" | "update" = "select";
  private patch: Row | null = null;
  private countOnly = false;
  private orderCol: string | null = null;
  private orderAscending = true;
  private rangeFrom: number | null = null;
  private rangeTo: number | null = null;
  private single = false;

  constructor(
    private rows: Row[],
    private onWrite?: () => void,
  ) {}

  select(_columns?: string, opts?: { count?: "exact"; head?: boolean }) {
    this.mode = "select";
    if (opts?.count) this.countOnly = true;
    return this;
  }

  update(patch: Row) {
    this.mode = "update";
    this.patch = patch;
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push([column, value]);
    return this;
  }

  order(column: string, opts?: { ascending?: boolean }) {
    this.orderCol = column;
    this.orderAscending = opts?.ascending ?? true;
    return this;
  }

  range(from: number, to: number) {
    this.rangeFrom = from;
    this.rangeTo = to;
    return this;
  }

  maybeSingle() {
    this.single = true;
    return this;
  }

  private matched(): Row[] {
    return this.rows.filter((row) => matches(row, this.filters));
  }

  private execute(): { data: unknown; error: null; count?: number } {
    if (this.mode === "update") {
      const matched = this.matched();
      for (const row of matched) Object.assign(row, this.patch);
      this.onWrite?.();
      return { data: null, error: null };
    }

    let matched = this.matched();
    if (this.countOnly) {
      return { data: null, error: null, count: matched.length };
    }
    if (this.orderCol) {
      const col = this.orderCol;
      matched = [...matched].sort((a, b) => {
        const av = String(a[col]);
        const bv = String(b[col]);
        if (av === bv) return 0;
        const cmp = av < bv ? -1 : 1;
        return this.orderAscending ? cmp : -cmp;
      });
    }
    if (this.rangeFrom != null && this.rangeTo != null) {
      matched = matched.slice(this.rangeFrom, this.rangeTo + 1);
    }
    if (this.single) {
      return { data: matched[0] ?? null, error: null };
    }
    return { data: matched, error: null };
  }

  then<TResult1 = { data: unknown; error: null; count?: number }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: null; count?: number }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }
}

export interface MockNotificationSeed {
  id: string;
  profile_id: string;
  type: string;
  title: string;
  body: string;
  action_url: string | null;
  data: Record<string, unknown>;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

/** Fake `realtime-js` channel: enough surface for `.on().subscribe()` +
 * `client.removeChannel()`, no actual push (this harness is static fixture
 * data, not a live badge-increment demo). */
function createStubChannel() {
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

export function createMockNotificationsClient(
  profileId: string,
  profile: Row,
  seedNotifications: MockNotificationSeed[],
): InkdSupabaseClient {
  const notifications: Row[] = seedNotifications.map((n) => ({ ...n }));
  const profiles: Row[] = [profile];

  const client = {
    auth: {
      async getUser() {
        return { data: { user: { id: profileId } }, error: null };
      },
    },
    from(table: string) {
      if (table === "notifications") return new MockQueryBuilder(notifications);
      if (table === "profiles") return new MockQueryBuilder(profiles);
      throw new Error(`mock notifications client: unsupported table "${table}"`);
    },
    channel() {
      return createStubChannel();
    },
    removeChannel() {
      // no-op — no live subscription to tear down in this static harness.
    },
  };

  return client as unknown as InkdSupabaseClient;
}
