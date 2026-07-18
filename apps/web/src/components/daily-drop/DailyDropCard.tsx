"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Icon, cx } from "@inkd/ui/web";
import {
  useDropReact,
  useMarkDropClicked,
  useMarkDropSeen,
  type DailyDropCard as DailyDropCardData,
} from "@inkd/core";
import { flashPriceLabel } from "@/lib/format";
import { artworkGradient } from "@/components/feed/artwork";
import { FeedGlyph } from "@/components/feed/FeedGlyph";
import { FlashStamp } from "@/components/feed/FlashStamp";

export interface DailyDropCardProps {
  card: DailyDropCardData;
  /** "feed" = compact, mounted atop the feed. "full" = the dedicated surface. */
  variant?: "feed" | "full";
  signedIn?: boolean;
}

/**
 * The Daily Drop — INKD's daily "boom." One highlighted post/flash, picked for
 * the viewer, led by the plain-language "why." Deliberately louder than a feed
 * card: an ember placard header, a hero plate, the reason in the hand voice,
 * and direct CTAs (view artist, save, book, try-on). Marks itself seen on first
 * render and stamps a click when the viewer acts.
 */
export function DailyDropCard({ card, variant = "feed", signedIn = true }: DailyDropCardProps) {
  const seen = useMarkDropSeen();
  const clicked = useMarkDropClicked();
  const react = useDropReact();
  const firedSeen = useRef<string | null>(null);

  const seenAt = card.seenAt;
  useEffect(() => {
    if (firedSeen.current === card.id) return;
    firedSeen.current = card.id;
    if (!seenAt) seen.mutate(card.id);
  }, [card.id, seenAt, seen]);

  const artist = card.artist;
  const handle = artist?.handle ?? null;
  const artistName = artist?.displayName ?? (handle ? `@${handle}` : "INKD artist");
  const artistHref = handle ? `/a/${handle}` : null;
  const isFlash = card.subjectType === "flash";
  const image = isFlash ? card.flash?.imageUrl ?? null : card.post?.coverUrl ?? null;
  const styleTags = (isFlash ? card.flash?.styleTags : card.post?.styleTags) ?? [];
  const location = [artist?.city, artist?.state].filter(Boolean).join(", ");

  const stampClick = () => clicked.mutate(card.id);

  const full = variant === "full";

  return (
    <section
      aria-label="Today's drop"
      className={cx(
        "overflow-hidden rounded-sm border border-border-accent bg-surface-base shadow-[0_0_0_1px_rgba(0,0,0,0.2)]",
        full && "sm:flex sm:items-stretch",
      )}
    >
      {/* Hero plate */}
      <div
        className={cx("relative", full ? "sm:w-1/2" : "w-full")}
        style={{ background: artworkGradient(`drop:${card.subjectId}`, { ember: isFlash }) }}
      >
        <div className={cx("relative", full ? "aspect-[4/5] sm:h-full sm:aspect-auto" : "aspect-[16/10]")}>
          {image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image}
              alt={card.reason}
              // The "full" surface variant is the hero of /daily-drop (LCP
              // candidate) — keep it eager. The compact "feed" variant is one
              // of many cards in a scroll, so defer it like other feed media.
              loading={full ? "eager" : "lazy"}
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
          <div className="absolute left-3 top-3 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-sm bg-brand px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-brand-on">
              <Icon name="sparkles" size={12} />
              Today&apos;s drop
            </span>
            {isFlash && <FlashStamp />}
          </div>
        </div>
      </div>

      {/* Details */}
      <div className={cx("flex flex-col gap-4 p-4 sm:p-5", full && "sm:w-1/2 sm:justify-center")}>
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-content-ember">
            Picked for you
          </span>
          <p className={cx("font-hand leading-tight text-content-primary", full ? "text-3xl" : "text-2xl")}>
            {card.reason}
          </p>
        </div>

        {/* Artist byline */}
        <div className="flex items-center justify-between gap-3 border-t border-border-subtle pt-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            {artistHref ? (
              <Link
                href={artistHref}
                onClick={stampClick}
                className="truncate font-display text-base font-bold text-content-primary outline-none hover:text-content-accent focus-visible:text-content-accent"
              >
                {artistName}
              </Link>
            ) : (
              <span className="truncate font-display text-base font-bold text-content-primary">{artistName}</span>
            )}
            <span className="truncate font-mono text-[11px] uppercase tracking-[0.16em] text-content-muted">
              {styleTags.length > 0 ? styleTags.slice(0, 2).map((s) => s.name).join(" · ") : "Tattoo"}
              {location && <> · {location}</>}
            </span>
          </div>
          {isFlash && (
            <span className="shrink-0 font-hand text-2xl leading-none text-content-ember">
              {flashPriceLabel(card.flash?.priceCents ?? null)}
            </span>
          )}
        </div>

        {/* CTAs */}
        <div className="flex flex-wrap items-center gap-2">
          {artistHref && (
            <Link
              href={artistHref}
              onClick={stampClick}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-sm bg-brand px-3.5 py-2.5 font-sans text-sm font-semibold text-brand-on outline-none transition-colors hover:bg-brand-hover focus-visible:ring-2 focus-visible:ring-brand"
            >
              {isFlash ? "Book this flash" : "View artist"}
              <Icon name="arrow-right" size={15} />
            </Link>
          )}

          {!isFlash && card.post && (
            <>
              <button
                type="button"
                disabled={!signedIn}
                aria-pressed={card.post.likedByViewer}
                aria-label={card.post.likedByViewer ? "Unlike this piece" : "Like this piece"}
                onClick={() =>
                  react.mutate({
                    dropId: card.id,
                    postId: card.subjectId,
                    action: "like",
                    on: !card.post!.likedByViewer,
                  })
                }
                className={cx(
                  "inline-flex min-h-10 min-w-10 items-center justify-center gap-1.5 rounded-sm border border-border px-3 py-2.5 font-sans text-sm font-medium outline-none transition-colors hover:border-border-strong focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-40",
                  card.post.likedByViewer ? "text-danger-500" : "text-content-secondary",
                )}
              >
                <FeedGlyph name="heart" size={16} filled={card.post.likedByViewer} />
                {card.post.likeCount > 0 && (
                  <span className="font-mono text-xs tabular-nums">{card.post.likeCount}</span>
                )}
              </button>
              <button
                type="button"
                disabled={!signedIn}
                aria-pressed={card.post.savedByViewer}
                aria-label={card.post.savedByViewer ? "Remove from saved" : "Save for later"}
                onClick={() =>
                  react.mutate({
                    dropId: card.id,
                    postId: card.subjectId,
                    action: "save",
                    on: !card.post!.savedByViewer,
                  })
                }
                className={cx(
                  "inline-flex min-h-10 min-w-10 items-center justify-center gap-1.5 rounded-sm border border-border px-3 py-2.5 font-sans text-sm font-medium outline-none transition-colors hover:border-border-strong focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-40",
                  card.post.savedByViewer ? "text-content-accent" : "text-content-secondary",
                )}
              >
                <FeedGlyph name="bookmark" size={16} filled={card.post.savedByViewer} />
                {card.post.savedByViewer ? "Saved" : "Save"}
              </button>
            </>
          )}

          <Link
            href="/try-on"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-sm border-2 border-content-accent px-3.5 py-2.5 font-sans text-sm font-semibold text-content-accent outline-none transition-colors hover:bg-content-accent hover:text-surface-base focus-visible:ring-2 focus-visible:ring-brand"
          >
            <Icon name="sparkles" size={15} />
            Try it on
          </Link>
        </div>
      </div>
    </section>
  );
}
