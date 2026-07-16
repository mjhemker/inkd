/**
 * Pure helpers for the weekly-hours editor (Google-Calendar / Calendly-style
 * grid). No I/O, no platform deps — runs identically on web + RN and is unit
 * tested offline.
 *
 * The editor models an artist's week as a flat list of open BLOCKS. Multiple
 * blocks per weekday are first-class (e.g. Tue 11:00–14:00 + 17:00–21:00). An
 * empty weekday means "closed" — there is no per-day open/closed toggle.
 *
 * Blocks map 1:1 onto `availability_rules` rows (weekday + start/end, is_open).
 * A block with an `id` corresponds to a persisted row; a block without one is
 * new and will be inserted. Saving diffs the desired blocks against the
 * persisted rows and emits an insert/update/delete plan (set reconciliation) so
 * unchanged rows are never churned.
 */
import type { AvailabilityRule } from "../types/rows";

/** Minutes granularity the grid snaps to. */
export const SNAP_MINUTES = 15;
/** Minutes in a full day. */
export const DAY_MINUTES = 24 * 60;

/** One open window in the week. `id` present ⇒ backed by a persisted row. */
export interface WeeklyBlock {
  id?: string;
  /** 0 = Sunday … 6 = Saturday (matches DB `weekday`). */
  weekday: number;
  /** "HH:MM", inclusive start. */
  start: string;
  /** "HH:MM", exclusive end. Always > start. */
  end: string;
}

/** Normalize a "HH:MM[:SS]" string to "HH:MM". */
export function toHHMM(time: string): string {
  return time.slice(0, 5);
}

/** "HH:MM" → minutes since midnight. */
export function timeToMinutes(time: string): number {
  const [h, m] = toHHMM(time).split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Minutes since midnight → "HH:MM" (clamped to [0, 1440]). */
export function minutesToTime(mins: number): string {
  const clamped = Math.max(0, Math.min(DAY_MINUTES, Math.round(mins)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Round a minute value to the nearest `SNAP_MINUTES` step. */
export function snapMinutes(mins: number, step = SNAP_MINUTES): number {
  return Math.round(mins / step) * step;
}

/** Convert persisted rules into editor blocks (open rows only). */
export function rulesToBlocks(rules: AvailabilityRule[]): WeeklyBlock[] {
  return rules
    .filter((r) => r.is_open)
    .map((r) => ({
      id: r.id,
      weekday: r.weekday,
      start: toHHMM(r.start_time),
      end: toHHMM(r.end_time),
    }))
    .sort(
      (a, b) =>
        a.weekday - b.weekday || timeToMinutes(a.start) - timeToMinutes(b.start),
    );
}

/**
 * Merge overlapping/adjacent blocks within each weekday into clean contiguous
 * windows. Two blocks merge when they touch or overlap (end >= next start).
 * The surviving block keeps the earliest block's `id` (so a merge reconciles as
 * an update + delete rather than delete + insert). Blocks on different weekdays
 * never merge.
 */
export function mergeWeeklyBlocks(blocks: WeeklyBlock[]): WeeklyBlock[] {
  const byDay = new Map<number, WeeklyBlock[]>();
  for (const b of blocks) {
    const list = byDay.get(b.weekday) ?? [];
    list.push(b);
    byDay.set(b.weekday, list);
  }
  const out: WeeklyBlock[] = [];
  for (const [weekday, list] of byDay) {
    const sorted = [...list].sort(
      (a, b) => timeToMinutes(a.start) - timeToMinutes(b.start),
    );
    let cur: WeeklyBlock | null = null;
    for (const next of sorted) {
      if (!cur) {
        cur = { ...next };
        continue;
      }
      if (timeToMinutes(next.start) <= timeToMinutes(cur.end)) {
        // Overlap or touch → extend the current window.
        if (timeToMinutes(next.end) > timeToMinutes(cur.end)) cur.end = next.end;
        // Prefer keeping a persisted id if the current window doesn't have one.
        if (!cur.id && next.id) cur.id = next.id;
      } else {
        out.push(cur);
        cur = { ...next };
      }
    }
    if (cur) out.push(cur);
    void weekday;
  }
  return out.sort(
    (a, b) =>
      a.weekday - b.weekday || timeToMinutes(a.start) - timeToMinutes(b.start),
  );
}

/**
 * Does `candidate` overlap any existing block on the same weekday? Adjacent
 * (end == start) is NOT an overlap. Ignores the block with `ignoreId` (itself,
 * when resizing/moving).
 */
export function hasOverlap(
  candidate: WeeklyBlock,
  blocks: WeeklyBlock[],
  ignoreId?: string,
): boolean {
  const cs = timeToMinutes(candidate.start);
  const ce = timeToMinutes(candidate.end);
  return blocks.some((b) => {
    if (b.weekday !== candidate.weekday) return false;
    if (ignoreId && b.id === ignoreId) return false;
    if (b === candidate) return false;
    const bs = timeToMinutes(b.start);
    const be = timeToMinutes(b.end);
    return cs < be && bs < ce;
  });
}

/** Insert/update/delete plan reconciling persisted rows against desired blocks. */
export interface RuleReconciliation {
  toInsert: { weekday: number; start: string; end: string }[];
  toUpdate: { id: string; weekday: number; start: string; end: string }[];
  toDelete: string[];
}

/**
 * Diff persisted `availability_rules` against the editor's desired blocks.
 * - desired block with no id, or an id no longer in `existing` → insert
 * - desired block whose id exists but start/end/weekday changed → update
 * - persisted row whose id is not among desired → delete
 * Unchanged rows produce no operation.
 */
export function diffAvailabilityRules(
  existing: AvailabilityRule[],
  desired: WeeklyBlock[],
): RuleReconciliation {
  const byId = new Map(existing.map((r) => [r.id, r]));
  const keptIds = new Set<string>();
  const toInsert: RuleReconciliation["toInsert"] = [];
  const toUpdate: RuleReconciliation["toUpdate"] = [];

  for (const block of desired) {
    const prev = block.id ? byId.get(block.id) : undefined;
    if (!prev) {
      toInsert.push({
        weekday: block.weekday,
        start: block.start,
        end: block.end,
      });
      continue;
    }
    keptIds.add(prev.id);
    const changed =
      prev.weekday !== block.weekday ||
      toHHMM(prev.start_time) !== toHHMM(block.start) ||
      toHHMM(prev.end_time) !== toHHMM(block.end) ||
      !prev.is_open;
    if (changed) {
      toUpdate.push({
        id: prev.id,
        weekday: block.weekday,
        start: block.start,
        end: block.end,
      });
    }
  }

  const toDelete = existing
    .filter((r) => !keptIds.has(r.id))
    .map((r) => r.id);

  return { toInsert, toUpdate, toDelete };
}
