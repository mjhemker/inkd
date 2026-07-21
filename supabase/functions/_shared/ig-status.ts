// Pure response-shaping for the Instagram status + disconnect endpoints. No I/O
// and NO `npm:` / `Deno.*` imports, so it runs unmodified under both the Deno
// edge runtime and Node's built-in test runner:
//   node --import ./scripts/node-test-resolve-ts.mjs --test \
//     supabase/functions/_shared/ig-status.test.ts
//
// instagram-status reads the caller's instagram_connections row (service role)
// and returns EXACTLY the fields below — never a token field. instagram-disconnect
// returns DISCONNECT_RESPONSE.

/** The subset of instagram_connections that status shaping reads. */
export interface IgConnectionRow {
  ig_username?: string | null;
  connected_at?: string | null;
  last_synced_at?: string | null;
  token_expires_at?: string | null;
}

/** The exact instagram-status response contract (never includes a token). */
export interface IgStatusResponse {
  connected: boolean;
  ig_username: string | null;
  connected_at: string | null;
  last_synced_at: string | null;
  token_expired: boolean;
}

/**
 * Shape the status response from a connection row (or null when the artist has
 * no connection). `nowMs` is injected so the token-expiry check is deterministic
 * and unit-testable. A missing/blank token_expires_at is treated as not expired.
 */
export function shapeStatusResponse(
  row: IgConnectionRow | null | undefined,
  nowMs: number,
): IgStatusResponse {
  if (!row) {
    return {
      connected: false,
      ig_username: null,
      connected_at: null,
      last_synced_at: null,
      token_expired: false,
    };
  }
  const exp = row.token_expires_at ? new Date(row.token_expires_at).getTime() : NaN;
  const token_expired = Number.isFinite(exp) && exp < nowMs;
  return {
    connected: true,
    ig_username: row.ig_username ?? null,
    connected_at: row.connected_at ?? null,
    last_synced_at: row.last_synced_at ?? null,
    token_expired,
  };
}

/** The exact instagram-disconnect response (idempotent — same on a no-op). */
export const DISCONNECT_RESPONSE = { ok: true, disconnected: true } as const;
