/**
 * Shared helpers for the data-access layer. Every domain module follows the
 * same contract: take an INKD Supabase client as the first argument, validate
 * inputs with zod, and either return narrow data or throw the Postgrest error.
 *
 * No service-role usage anywhere — all queries run under the caller's RLS
 * session, which is what makes these safe to call directly from app screens.
 */
import type {
  PostgrestSingleResponse,
  PostgrestMaybeSingleResponse,
  PostgrestResponse,
} from "@supabase/supabase-js";

/** For `.single()` / `insert().select().single()` — data is guaranteed present. */
export function unwrap<T>(result: PostgrestSingleResponse<T>): T {
  if (result.error) throw result.error;
  return result.data;
}

/** For `.maybeSingle()` — returns null when the row is absent / not visible. */
export function unwrapMaybe<T>(result: PostgrestMaybeSingleResponse<T>): T | null {
  if (result.error) throw result.error;
  return result.data;
}

/** For list selects — throws on error, otherwise returns the (possibly empty) array. */
export function unwrapList<T>(result: PostgrestResponse<T>): T[] {
  if (result.error) throw result.error;
  return result.data ?? [];
}

export interface ListParams {
  limit?: number;
  offset?: number;
  /** Ascending order? Defaults vary per query; documented at the call site. */
  ascending?: boolean;
}

/** Clamp a caller-supplied page size to a sane range. */
export function clampLimit(limit: number | undefined, fallback = 50): number {
  if (limit == null) return fallback;
  return Math.max(1, Math.min(200, Math.floor(limit)));
}
