/**
 * "Match my inspiration" — the presentation + orchestration layer over the
 * Wave-1 visual-similarity backend (`similar_works` RPC + the `tag-image`
 * edge function's `inline` mode, both consumed via ./similarWorks).
 *
 * This module deliberately owns NO backend: it never re-implements tagging or
 * the KNN search. It (a) turns a query image's inline tags into a human "here's
 * what INKD saw" summary, (b) groups the ranked `similar_works` neighbors by
 * artist into a curated-gallery shape with a plain-language match reason and a
 * similarity indicator, and (c) classifies the realistic edge cases
 * (no readable style / no matches / only-weak matches) so the UI can degrade
 * gracefully. All the ranking/grouping/reason/classification logic is pure and
 * unit-tested; the async helpers are thin, RLS-scoped reads.
 *
 * The one thing the client CANNOT do directly is call `tag-image` — it is
 * bearer-gated (the AI-runtime token, NOT a user JWT). So the tag step goes
 * through an authenticated proxy (the web `/api/match-inspiration` route
 * handler); `requestInspirationTags()` is the platform-neutral caller for it.
 */
import { z } from "zod";

import type { InkdSupabaseClient } from "../supabase/client";
import type { DiscoverParams } from "./discover";
import type {
  ImageColorType,
  ImageSubjectType,
  ImageTagResult,
  InlineTagResponse,
  SimilarWork,
} from "./similarWorks";

// ---------------------------------------------------------------------------
// Tunables — the thresholds that separate the outcome states. Kept together and
// exported so the tests (and any future tuning) pin one source of truth.
// ---------------------------------------------------------------------------
/** Below this top-style confidence the query image has no *clear* aesthetic. */
export const STYLE_CLARITY_THRESHOLD = 0.3;
/** A per-artist group is only "strong" at/above this cosine similarity. */
export const STRONG_MATCH_THRESHOLD = 0.72;
export const CLOSE_MATCH_THRESHOLD = 0.55;
export const LOOSE_MATCH_THRESHOLD = 0.38;
/** If the very best group is below this, treat the whole run as "low match". */
export const LOW_MATCH_CEILING = CLOSE_MATCH_THRESHOLD;
/** How many works to surface per artist card (a taste, not the whole folio). */
export const MAX_WORKS_PER_ARTIST = 4;

// ---------------------------------------------------------------------------
// Formatting helpers (pure)
// ---------------------------------------------------------------------------
/** Title-case a canonical style slug, e.g. `fine-line` -> `Fine Line`. */
export function formatStyleLabel(slug: string): string {
  return slug
    .split("-")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

const COLOR_LABELS: Record<ImageColorType, string> = {
  color: "Color",
  black_grey: "Black & grey",
  both: "Color + black & grey",
  unknown: "Color unclear",
};
export function formatColorLabel(color: ImageColorType): string {
  return COLOR_LABELS[color] ?? COLOR_LABELS.unknown;
}

/** Cosine similarity (0..1) as a whole-percent, clamped. */
export function similarityToPercent(similarity: number): number {
  if (!Number.isFinite(similarity)) return 0;
  return Math.max(0, Math.min(100, Math.round(similarity * 100)));
}

/** A short strength word for a similarity score, for the indicator chip. */
export function matchStrengthLabel(similarity: number): string {
  if (similarity >= STRONG_MATCH_THRESHOLD) return "Strong match";
  if (similarity >= CLOSE_MATCH_THRESHOLD) return "Close match";
  if (similarity >= LOOSE_MATCH_THRESHOLD) return "Loose match";
  return "Related";
}

// ---------------------------------------------------------------------------
// "What INKD saw" — turn inline tags into a trust-building, refinable summary.
// ---------------------------------------------------------------------------
export interface DetectedStyle {
  slug: string;
  label: string;
  confidence: number;
}

export interface InspirationSummary {
  styles: DetectedStyle[];
  placement: string[];
  colorType: ImageColorType;
  colorLabel: string;
  sizeEstimate: ImageTagResult["size_estimate"];
  subjects: string[];
  /** The 1-line scene description the classifier returned (may be empty). */
  description: string;
  /**
   * True when there is at least one style whose confidence clears the clarity
   * threshold. When false the UI shows the graceful "we couldn't read a clear
   * style" path instead of pretending to have matched an aesthetic.
   */
  hasClearStyle: boolean;
}

/** Build the human summary of a query image's inline tags. Pure. */
export function describeInspiration(tags: ImageTagResult): InspirationSummary {
  const styles: DetectedStyle[] = [...(tags.styles ?? [])]
    .filter((s) => s && typeof s.slug === "string")
    .sort((a, b) => b.confidence - a.confidence)
    .map((s) => ({
      slug: s.slug,
      label: formatStyleLabel(s.slug),
      confidence: s.confidence,
    }));
  const hasClearStyle =
    styles.length > 0 && styles[0]!.confidence >= STYLE_CLARITY_THRESHOLD;
  return {
    styles,
    placement: (tags.placement ?? []).filter(Boolean),
    colorType: tags.color_type ?? "unknown",
    colorLabel: formatColorLabel(tags.color_type ?? "unknown"),
    sizeEstimate: tags.size_estimate ?? "unknown",
    subjects: (tags.subject_matter ?? []).filter(Boolean),
    description: (tags.description ?? "").trim(),
    hasClearStyle,
  };
}

// ---------------------------------------------------------------------------
// Grouping ranked neighbors into per-artist gallery cards.
// ---------------------------------------------------------------------------
/** Minimal identity for an artist behind a matched work. */
export interface ArtistBrief {
  artistId: string;
  profileId: string;
  handle: string | null;
  displayName: string;
  avatarUrl: string | null;
}

/** One matched work inside an artist's group. */
export interface MatchWork {
  subjectType: ImageSubjectType;
  subjectId: string;
  imageUrl: string | null;
  styles: string[];
  colorType: ImageColorType;
  similarity: number;
  similarityPercent: number;
}

/** A ranked artist group — the unit the results gallery renders. */
export interface MatchArtistGroup {
  artistId: string;
  handle: string | null;
  displayName: string;
  avatarUrl: string | null;
  /** `/a/[handle]` when a handle exists, else null (card is non-linking). */
  profileHref: string | null;
  works: MatchWork[];
  /** Best work's similarity — the group's rank key + indicator value. */
  topSimilarity: number;
  topSimilarityPercent: number;
  matchLabel: string;
  /** Plain-language reason, e.g. "Fine line + floral, like your inspiration". */
  matchReason: string;
  /** Which of the inspiration's styles this artist shares (labels). */
  sharedStyleLabels: string[];
}

/** A per-piece deep link within an artist profile (styles anchor the section). */
export function workHref(handle: string | null, work: MatchWork): string | null {
  if (!handle) return null;
  const base = `/a/${handle}`;
  // The public profile renders posts/portfolio/flash in labeled sections; deep
  // link to the closest section so "the specific piece" lands in context.
  const section =
    work.subjectType === "flash_item"
      ? "flash"
      : work.subjectType === "portfolio_piece"
        ? "portfolio"
        : "work";
  return `${base}#${section}-${work.subjectId}`;
}

function toMatchWork(row: SimilarWork): MatchWork {
  return {
    subjectType: row.subject_type,
    subjectId: row.subject_id,
    imageUrl: row.image_url,
    styles: row.styles ?? [],
    colorType: row.color_type,
    similarity: row.similarity,
    similarityPercent: similarityToPercent(row.similarity),
  };
}

/**
 * Compose the plain-language match reason. Prefers the styles the artist shares
 * with the inspiration ("Fine line + floral, like your inspiration"); falls
 * back to the artist's own dominant styles, then to a color/– generic line, so
 * a reason is ALWAYS present even when the overlap is empty.
 */
export function buildMatchReason(
  sharedStyleLabels: string[],
  groupStyleLabels: string[],
  colorLabel: string,
): string {
  if (sharedStyleLabels.length > 0) {
    return `${joinStyles(sharedStyleLabels)}, like your inspiration`;
  }
  if (groupStyleLabels.length > 0) {
    return `${joinStyles(groupStyleLabels)} — a related aesthetic`;
  }
  return `Similar ${colorLabel.toLowerCase()} work`;
}

function joinStyles(labels: string[]): string {
  const top = labels.slice(0, 2);
  if (top.length <= 1) return top[0] ?? "";
  return `${top[0]} + ${top[1]}`;
}

export interface GroupOptions {
  /** Canonical style slugs detected in the inspiration (drives shared styles). */
  inspirationStyleSlugs?: string[];
  /** The inspiration's color label, for the generic reason fallback. */
  inspirationColorLabel?: string;
  /** Cap on works surfaced per artist (default MAX_WORKS_PER_ARTIST). */
  maxWorksPerArtist?: number;
}

/**
 * Group ranked `similar_works` rows into per-artist gallery cards, ranked by
 * each artist's single best-matching piece. Rows with a null artist_id (should
 * not happen for public works, but be safe) are dropped. Pure — the artist
 * identity map is supplied by `enrichMatchArtists`.
 */
export function groupSimilarWorks(
  rows: SimilarWork[],
  artists: Map<string, ArtistBrief>,
  opts: GroupOptions = {},
): MatchArtistGroup[] {
  const inspoSlugs = new Set(opts.inspirationStyleSlugs ?? []);
  const maxWorks = opts.maxWorksPerArtist ?? MAX_WORKS_PER_ARTIST;
  const colorLabel = opts.inspirationColorLabel ?? "";

  const byArtist = new Map<string, SimilarWork[]>();
  for (const row of rows) {
    if (!row.artist_id) continue;
    const bucket = byArtist.get(row.artist_id);
    if (bucket) bucket.push(row);
    else byArtist.set(row.artist_id, [row]);
  }

  const groups: MatchArtistGroup[] = [];
  for (const [artistId, artistRows] of byArtist) {
    const sorted = [...artistRows].sort((a, b) => b.similarity - a.similarity);
    const works = sorted.slice(0, maxWorks).map(toMatchWork);
    const top = sorted[0]!;

    // Shared styles = inspiration styles present anywhere in this artist's
    // matched works (order by the inspiration's own ranking for a stable read).
    const groupStyleSet = new Set<string>();
    for (const w of sorted) for (const s of w.styles ?? []) groupStyleSet.add(s);
    const sharedSlugs = (opts.inspirationStyleSlugs ?? []).filter((s) =>
      groupStyleSet.has(s),
    );
    const sharedStyleLabels = sharedSlugs.map(formatStyleLabel);

    // The artist's own dominant styles (for the reason fallback): most frequent
    // across matched works, excluding those already named as shared.
    const freq = new Map<string, number>();
    for (const w of sorted)
      for (const s of w.styles ?? [])
        if (!inspoSlugs.has(s)) freq.set(s, (freq.get(s) ?? 0) + 1);
    const groupStyleLabels = [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([slug]) => formatStyleLabel(slug));

    const brief = artists.get(artistId);
    const handle = brief?.handle ?? null;
    groups.push({
      artistId,
      handle,
      displayName: brief?.displayName ?? "INKD artist",
      avatarUrl: brief?.avatarUrl ?? null,
      profileHref: handle ? `/a/${handle}` : null,
      works,
      topSimilarity: top.similarity,
      topSimilarityPercent: similarityToPercent(top.similarity),
      matchLabel: matchStrengthLabel(top.similarity),
      matchReason: buildMatchReason(sharedStyleLabels, groupStyleLabels, colorLabel),
      sharedStyleLabels,
    });
  }

  groups.sort((a, b) => b.topSimilarity - a.topSimilarity);
  return groups;
}

// ---------------------------------------------------------------------------
// Outcome classification — the graceful-degradation decision.
// ---------------------------------------------------------------------------
export type MatchOutcome = "ok" | "no_style" | "no_match" | "low_match";

/**
 * Decide how the UI should present a run:
 *  - `no_style`  : the image has no readable tattoo aesthetic → suggest another
 *                  image or browse-by-style (never pretend to have matched).
 *  - `no_match`  : a clear style, but zero neighbors → closest-styles + browse.
 *  - `low_match` : neighbors exist but even the best is weak → show them, but
 *                  frame as "closest we found" + browse-by-style CTA.
 *  - `ok`        : confident, ranked results.
 */
export function classifyMatchOutcome(
  summary: InspirationSummary,
  groups: MatchArtistGroup[],
): MatchOutcome {
  if (!summary.hasClearStyle) return "no_style";
  if (groups.length === 0) return "no_match";
  if (groups[0]!.topSimilarity < LOW_MATCH_CEILING) return "low_match";
  return "ok";
}

// ---------------------------------------------------------------------------
// Async helpers — RLS-scoped reads. No service role.
// ---------------------------------------------------------------------------
/**
 * Resolve artist identities (handle/display name/avatar) for a set of
 * `artist_profiles.id` values (what `similar_works` returns as `artist_id`).
 * One batched read of artist_profiles + its embedded profile.
 */
export async function enrichMatchArtists(
  client: InkdSupabaseClient,
  artistIds: string[],
): Promise<Map<string, ArtistBrief>> {
  const unique = Array.from(new Set(artistIds.filter(Boolean)));
  const map = new Map<string, ArtistBrief>();
  if (unique.length === 0) return map;
  const { data, error } = await client
    .from("artist_profiles")
    .select("id, profile_id, profiles(display_name, handle, avatar_url)")
    .in("id", unique);
  if (error) throw error;
  const rows = (data ?? []) as unknown as {
    id: string;
    profile_id: string;
    profiles: {
      display_name: string | null;
      handle: string | null;
      avatar_url: string | null;
    } | null;
  }[];
  for (const r of rows) {
    map.set(r.id, {
      artistId: r.id,
      profileId: r.profile_id,
      handle: r.profiles?.handle ?? null,
      displayName: r.profiles?.display_name ?? "INKD artist",
      avatarUrl: r.profiles?.avatar_url ?? null,
    });
  }
  return map;
}

/** Bucket/prefix for transient inspiration query images (private, per-user). */
export const INSPIRATION_BUCKET = "media";
export const INSPIRATION_FOLDER = "inspiration";

type UploadBody = Blob | ArrayBuffer | ArrayBufferView;

function inferExt(name: string, contentType?: string): string {
  const dot = name.lastIndexOf(".");
  if (dot > -1 && dot < name.length - 1) {
    return name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  }
  if (contentType?.includes("/")) {
    return contentType.split("/")[1]!.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  }
  return "jpg";
}

function randomId(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export interface UploadedInspiration {
  /** Storage path within the media bucket (`<uid>/inspiration/<uuid>.<ext>`). */
  path: string;
  /** Short-lived signed URL the tag proxy can fetch server-side. */
  signedUrl: string;
}

/**
 * Upload a transient inspiration image to the caller's private prefix and mint
 * a short-lived signed URL for it. Deliberately NOT a public path: the image is
 * transient and private — `deleteInspirationImage` removes it once matched (or
 * the object simply expires from the signed URL's reach). Storage RLS allows
 * the write because the first path segment is the owner's uid.
 */
export async function uploadInspirationImage(
  client: InkdSupabaseClient,
  userId: string,
  file: { data: UploadBody; name: string; contentType?: string },
  signedUrlTtlSeconds = 600,
): Promise<UploadedInspiration> {
  const ext = inferExt(file.name, file.contentType);
  const path = `${userId}/${INSPIRATION_FOLDER}/${randomId()}.${ext}`;
  const { error } = await client.storage
    .from(INSPIRATION_BUCKET)
    .upload(path, file.data, { contentType: file.contentType, upsert: false });
  if (error) throw error;
  const { data, error: signErr } = await client.storage
    .from(INSPIRATION_BUCKET)
    .createSignedUrl(path, signedUrlTtlSeconds);
  if (signErr || !data?.signedUrl) {
    throw signErr ?? new Error("Could not sign inspiration image URL");
  }
  return { path, signedUrl: data.signedUrl };
}

/** Delete a transient inspiration object (best-effort — swallows errors). */
export async function deleteInspirationImage(
  client: InkdSupabaseClient,
  path: string,
): Promise<void> {
  try {
    await client.storage.from(INSPIRATION_BUCKET).remove([path]);
  } catch {
    // transient cleanup — never surface to the user
  }
}

// ---------------------------------------------------------------------------
// The bearer-gated tag step, via an authenticated proxy.
// ---------------------------------------------------------------------------
export class InspirationTagError extends Error {
  code: string;
  status: number;
  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = "InspirationTagError";
    this.code = code;
    this.status = status;
  }
}

export const requestTagsParamsSchema = z.object({
  /** Proxy endpoint. Web: "/api/match-inspiration"; mobile: absolute URL. */
  endpoint: z.string().min(1),
  /** Publicly-fetchable (signed) URL of the query image. */
  imageUrl: z.string().url(),
  /** Supabase access token, forwarded so the proxy can authenticate the user. */
  accessToken: z.string().optional(),
});
export type RequestTagsParams = z.input<typeof requestTagsParamsSchema>;

/**
 * Call the authenticated `tag-image` proxy and return the query image's inline
 * tags + embedding. Platform-neutral (uses global fetch). Throws a typed
 * `InspirationTagError` so callers can map `not_configured` (503) to a friendly
 * "image search isn't switched on yet" instead of a raw failure.
 */
export async function requestInspirationTags(
  params: RequestTagsParams,
): Promise<InlineTagResponse> {
  const p = requestTagsParamsSchema.parse(params);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (p.accessToken) headers.Authorization = `Bearer ${p.accessToken}`;

  let res: Response;
  try {
    res = await fetch(p.endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({ image_url: p.imageUrl }),
    });
  } catch (err) {
    throw new InspirationTagError(
      err instanceof Error ? err.message : "Network error reaching tag proxy",
      "network_error",
      0,
    );
  }

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // fall through to status-based error
  }

  if (!res.ok) {
    const errObj =
      body && typeof body === "object" && "error" in body
        ? (body as { error?: { code?: string; message?: string } }).error
        : undefined;
    throw new InspirationTagError(
      errObj?.message ?? `Tag proxy failed (${res.status})`,
      errObj?.code ?? "tag_failed",
      res.status,
    );
  }
  return body as InlineTagResponse;
}

/** True when at least one discovery filter would actually narrow the search. */
export function hasAnyDiscoverFilter(f: DiscoverParams): boolean {
  return Boolean(
    (f.lat != null && f.lng != null) ||
      (f.styles && f.styles.length > 0) ||
      f.priceMin != null ||
      f.priceMax != null ||
      f.booksOpen ||
      f.state ||
      (f.query && f.query.trim().length > 0),
  );
}
