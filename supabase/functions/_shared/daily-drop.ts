// Daily Drop — the pure, deterministic selection algorithm (SPEC/founder:
// "a daily tattoo suggestion ... personalized to your preferences and the
// patterns seen with the styles you look up / artists you follow ... a daily
// boom to get people using the app day-to-day").
//
// This module is IO-free and dependency-free, so it runs identically under Deno
// (imported by the `daily-drop` edge function) and under `node --test`
// (daily-drop.test.ts) — same discipline as _shared/agent-scheduled.ts. The
// edge function does the DB reads (signals + candidates) and hands them here;
// all the taste + variety + cold-start logic lives in these pure functions.
//
// Affinity weights mirror public.user_style_affinity() in
// 20260717100000_daily_drops.sql — keep the two in sync.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type DropSubjectType = "post" | "flash";
export type AffinitySource = "follow" | "save" | "like" | "booking";

/** One canonical style slug the user leans toward, with its dominant source. */
export interface StyleAffinity {
  slug: string;
  weight: number;
  /** The signal that contributed most to this slug (drives the "why" copy). */
  source?: AffinitySource;
}

/** A poolable post/flash the drop could surface. `styles` are canonical slugs
 * (AI image_tags UNION post_styles); `styleConfidences` is parallel when the
 * styles came from image_tags (default 1 when absent). */
export interface DropCandidate {
  subjectType: DropSubjectType;
  subjectId: string;
  artistId: string | null;
  styles: string[];
  styleConfidences?: number[];
  /** Quality proxy (post like_count; 0 for flash). */
  likeCount: number;
  /** Public/available gate — non-available candidates are dropped up front. */
  isAvailable: boolean;
  createdAt: string;
  /** Optional 0..1 cosine similarity when pulled via similar_works seeding. */
  similarity?: number;
}

/** A prior drop for this user — used to exclude repeats and steer variety. */
export interface PriorDrop {
  subjectType: DropSubjectType;
  subjectId: string;
  artistId: string | null;
  reasonStyle: string | null;
  /** YYYY-MM-DD (UTC). */
  dropDate: string;
}

export interface SelectDailyDropOptions {
  affinity: StyleAffinity[];
  candidates: DropCandidate[];
  priorDrops: PriorDrop[];
  /** YYYY-MM-DD (UTC) — the drop day + part of the deterministic jitter seed. */
  dropDate: string;
  /** The recipient — seeds deterministic jitter so picks vary per user/day. */
  userId: string;
  /** The user's own artist_profiles.id, if they are an artist — never drop your own work. */
  excludeArtistId?: string | null;
}

export interface DropSelection {
  candidate: DropCandidate;
  score: number;
  reason: string;
  reasonStyle: string | null;
  isColdStart: boolean;
}

// ---------------------------------------------------------------------------
// Tunable weights (exported so the tests + docs pin them).
// ---------------------------------------------------------------------------
export const DAILY_DROP_WEIGHTS = {
  /** Multiplier on the affinity overlap (Σ affinity[style]·confidence). */
  affinity: 1.0,
  /** Multiplier on log1p(likeCount) — surfaces well-loved work. */
  quality: 0.6,
  /** Multiplier on similar_works cosine similarity (0..1). */
  similarity: 2.0,
  /** Flat baseline so cold-start still ranks by quality + jitter, never blank. */
  trending: 0.25,
  /** Deterministic per-(user,date,subject) jitter — diversity + tiebreak. */
  jitter: 0.5,
  /** Bonus for matching the variety-preferred subject type (flash/original mix). */
  mixBonus: 0.6,
  /** Penalty when the candidate's artist was dropped in the last few days. */
  recentArtistPenalty: 0.8,
  /** Extra penalty when it's literally yesterday's artist. */
  yesterdayArtistPenalty: 1.5,
  /** Penalty when the candidate's lead style was dropped in the last few days. */
  recentStylePenalty: 0.5,
} as const;

/** How many trailing days count as "recent" for the artist/style variety guard. */
export const VARIETY_LOOKBACK_DAYS = 3;

// ---------------------------------------------------------------------------
// Small deterministic hash → unit float in [0,1). FNV-1a over the seed string.
// ---------------------------------------------------------------------------
export function deterministicUnit(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // h is a 32-bit int (possibly negative); fold to [0,1).
  return ((h >>> 0) % 100000) / 100000;
}

// ---------------------------------------------------------------------------
// Affinity map helpers
// ---------------------------------------------------------------------------
export interface AffinityLookup {
  weight: (slug: string) => number;
  source: (slug: string) => AffinitySource | undefined;
  total: number;
  size: number;
}

export function buildAffinityLookup(affinity: StyleAffinity[]): AffinityLookup {
  const w = new Map<string, number>();
  const s = new Map<string, AffinitySource>();
  let total = 0;
  for (const a of affinity) {
    if (!a.slug) continue;
    w.set(a.slug, a.weight);
    if (a.source) s.set(a.slug, a.source);
    total += a.weight;
  }
  return {
    weight: (slug) => w.get(slug) ?? 0,
    source: (slug) => s.get(slug),
    total,
    size: w.size,
  };
}

/** Date diff in whole days (a - b), both YYYY-MM-DD. */
function daysBetween(a: string, b: string): number {
  const ms = Date.parse(a + "T00:00:00Z") - Date.parse(b + "T00:00:00Z");
  return Math.round(ms / 86_400_000);
}

// ---------------------------------------------------------------------------
// Reason copy
// ---------------------------------------------------------------------------
/** Title-case a canonical style slug: "black_grey" / "neo-traditional" → words. */
export function humanizeStyle(slug: string): string {
  return slug
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

export function buildDropReason(
  subjectType: DropSubjectType,
  reasonStyle: string | null,
  source: AffinitySource | undefined,
  isColdStart: boolean,
): string {
  if (isColdStart || !reasonStyle) {
    return subjectType === "flash"
      ? "A fresh flash drop to kick off your day"
      : "A standout piece trending on INKD right now";
  }
  const style = humanizeStyle(reasonStyle);
  switch (source) {
    case "follow":
      return `Because you follow artists who work in ${style}`;
    case "save":
      return `Because you've been saving ${style} work`;
    case "booking":
      return `Because you've booked ${style} artists`;
    case "like":
    default:
      return `Because you love ${style} work`;
  }
}

// ---------------------------------------------------------------------------
// Core selection
// ---------------------------------------------------------------------------
/**
 * Pick ONE drop for a user/day, or null when nothing eligible remains.
 *
 * Guarantees:
 *  - No-repeat: never re-picks a subject the user has already been dropped, and
 *    penalizes the artist/style shown in the last VARIETY_LOOKBACK_DAYS (with an
 *    extra penalty for literally yesterday's artist).
 *  - Flash/original mix: softly prefers the opposite subject_type of yesterday's
 *    drop, so a run of posts nudges a flash in (and vice versa) without ever
 *    forcing a worse pick when only one type is available.
 *  - Cold-start: when the user has no affinity signal, falls back to a
 *    trending + deterministic-jitter ranking over quality — a diverse,
 *    never-blank pick that differs across users and days.
 *  - Deterministic: same inputs → same pick (jitter seeded by user+date+subject),
 *    so re-running the job the same day is stable (idempotency is also enforced
 *    at the DB by unique(user_id, drop_date)).
 */
export function selectDailyDrop(opts: SelectDailyDropOptions): DropSelection | null {
  const aff = buildAffinityLookup(opts.affinity);
  const isColdStart = aff.size === 0;

  // Exclusions: already-dropped subjects (ever) + the user's own artist work +
  // non-available candidates.
  const seen = new Set(opts.priorDrops.map((d) => `${d.subjectType}:${d.subjectId}`));
  const pool = opts.candidates.filter(
    (c) =>
      c.isAvailable &&
      !seen.has(`${c.subjectType}:${c.subjectId}`) &&
      !(opts.excludeArtistId && c.artistId === opts.excludeArtistId),
  );
  if (pool.length === 0) return null;

  // Variety context from recent history.
  const sortedPriors = [...opts.priorDrops].sort((a, b) => (a.dropDate < b.dropDate ? 1 : -1));
  const yesterday = sortedPriors[0] ?? null;
  const recentArtistIds = new Set<string>();
  const recentStyles = new Set<string>();
  for (const d of opts.priorDrops) {
    if (daysBetween(opts.dropDate, d.dropDate) <= VARIETY_LOOKBACK_DAYS) {
      if (d.artistId) recentArtistIds.add(d.artistId);
      if (d.reasonStyle) recentStyles.add(d.reasonStyle);
    }
  }
  // Mix: prefer the opposite of yesterday's type when we have any such candidate.
  const preferredType: DropSubjectType | null = yesterday
    ? yesterday.subjectType === "post"
      ? "flash"
      : "post"
    : null;

  const W = DAILY_DROP_WEIGHTS;
  let best: DropSelection | null = null;

  for (const c of pool) {
    // Lead style = the candidate style with the highest affinity weight (falls
    // back to the first style). Drives both scoring emphasis and the reason.
    let leadStyle: string | null = null;
    let leadWeight = -1;
    let affinityScore = 0;
    for (let i = 0; i < c.styles.length; i++) {
      const slug = c.styles[i];
      const conf = c.styleConfidences?.[i] ?? 1;
      const w = aff.weight(slug);
      affinityScore += w * conf;
      if (w > leadWeight) {
        leadWeight = w;
        leadStyle = slug;
      }
    }
    if (leadStyle === null && c.styles.length > 0) leadStyle = c.styles[0];

    const qualityScore = Math.log1p(Math.max(0, c.likeCount)) * W.quality;
    const similarityScore = (c.similarity ?? 0) * W.similarity;
    const jitter = deterministicUnit(`${opts.userId}:${opts.dropDate}:${c.subjectType}:${c.subjectId}`) * W.jitter;

    let score =
      affinityScore * W.affinity + qualityScore + similarityScore + W.trending + jitter;

    if (preferredType && c.subjectType === preferredType) score += W.mixBonus;
    if (c.artistId && recentArtistIds.has(c.artistId)) score -= W.recentArtistPenalty;
    if (yesterday && c.artistId && c.artistId === yesterday.artistId) score -= W.yesterdayArtistPenalty;
    if (leadStyle && recentStyles.has(leadStyle)) score -= W.recentStylePenalty;

    if (
      best === null ||
      score > best.score ||
      // Stable tiebreak so the pick is fully deterministic.
      (score === best.score && c.subjectId < best.candidate.subjectId)
    ) {
      const source = leadStyle ? aff.source(leadStyle) : undefined;
      best = {
        candidate: c,
        score,
        reasonStyle: isColdStart ? null : leadStyle,
        isColdStart,
        reason: buildDropReason(c.subjectType, isColdStart ? null : leadStyle, source, isColdStart),
      };
    }
  }

  return best;
}
