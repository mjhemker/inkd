// Pure IG media -> INKD post/portfolio-piece mapping. No I/O — the
// instagram-import function does the fetch/download/upload/insert; this module
// only decides WHAT to create and is fully unit-tested offline:
//   node --test supabase/functions/_shared/instagram-mapper.test.ts
import type { IgMediaItem } from "./instagram.ts";

export type SkipReason = "no_image_source" | "already_imported";

export interface MappedMedia {
  mediaId: string;
  skip: boolean;
  skipReason?: SkipReason;
  /** The URL to download the image bytes from — `media_url` for images/
   * carousels, `thumbnail_url` for videos (INKD imports the still, not the
   * clip; SPEC's portfolio is photo-based). */
  sourceImageUrl?: string;
  post: {
    caption: string | null;
    source: "instagram";
    instagram_id: string;
    instagram_permalink: string | null;
    is_public: true;
  };
}

/** Filter out media the artist has already imported (by IG media id). */
export function filterAlreadyImported(
  items: IgMediaItem[],
  alreadyImportedIds: ReadonlySet<string>,
): IgMediaItem[] {
  return items.filter((item) => !alreadyImportedIds.has(item.id));
}

/**
 * Map a page of IG media to what INKD would create for each item. Videos
 * without a thumbnail and any item missing every image URL are marked
 * `skip: true` with a reason rather than thrown — one bad item in a page
 * should never abort the whole import run.
 */
export function mapInstagramMedia(items: IgMediaItem[]): MappedMedia[] {
  return items.map((item) => {
    const sourceImageUrl =
      item.media_type === "VIDEO"
        ? (item.thumbnail_url ?? null)
        : (item.media_url ?? item.thumbnail_url ?? null);

    const post: MappedMedia["post"] = {
      caption: normalizeCaption(item.caption),
      source: "instagram",
      instagram_id: item.id,
      instagram_permalink: item.permalink ?? null,
      is_public: true,
    };

    if (!sourceImageUrl) {
      return { mediaId: item.id, skip: true, skipReason: "no_image_source", post };
    }

    return { mediaId: item.id, skip: false, sourceImageUrl, post };
  });
}

function normalizeCaption(caption: string | null | undefined): string | null {
  if (!caption) return null;
  const trimmed = caption.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 4000) : null;
}

/** File extension to store the downloaded image under, inferred from the
 * source URL (IG CDN URLs are almost always .jpg, but this is defensive). */
export function inferImageExtension(sourceUrl: string, contentType?: string | null): string {
  const clean = sourceUrl.split("?")[0] ?? sourceUrl;
  const match = /\.(jpe?g|png|webp)$/i.exec(clean);
  if (match) return match[1]!.toLowerCase().replace("jpeg", "jpg");
  if (contentType?.includes("png")) return "png";
  if (contentType?.includes("webp")) return "webp";
  return "jpg";
}

/** Build the `portfolio_pieces` insert row for a successfully imported item. */
export function buildPortfolioPieceInsert(args: {
  mediaId: string;
  postId: string;
  imageUrl: string;
  sortOrder: number;
}): {
  post_id: string;
  instagram_media_id: string;
  image_url: string;
  is_public: true;
  sort_order: number;
} {
  return {
    post_id: args.postId,
    instagram_media_id: args.mediaId,
    image_url: args.imageUrl,
    is_public: true,
    sort_order: args.sortOrder,
  };
}
