"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Avatar, Button, Icon, cx } from "@inkd/ui/web";
import { tryOnHref, type FeedItem } from "@inkd/core";
import { LinkButton } from "@/components/link-button";
import { flashPriceLabel } from "@/lib/format";
import { artworkGradient } from "./artwork";
import { FeedGlyph } from "./FeedGlyph";
import { FlashStamp } from "./FlashStamp";
import { AvailabilityTag } from "./FeedCard";

export interface PostDetailOverlayProps {
  item: FeedItem;
  signedIn: boolean;
  onClose: () => void;
  onToggleLike: (item: FeedItem) => void;
  onToggleSave: (item: FeedItem) => void;
  onToggleFollow: (item: FeedItem) => void;
}

/**
 * The lightbox detail overlay a card opens into: artwork on one side, the full
 * placard story on the other — caption, style chips, the artist row with an
 * inline follow, like/save, and the booking/profile CTAs. Escape + backdrop
 * close it; the body scroll is locked while open.
 */
export function PostDetailOverlay({
  item,
  signedIn,
  onClose,
  onToggleLike,
  onToggleSave,
  onToggleFollow,
}: PostDetailOverlayProps) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const artist = item.artist;
  const isFlash = item.kind === "flash";
  const handle = artist.handle ?? undefined;
  const src = item.kind === "post" ? item.coverUrl : item.imageUrl;
  const location = [artist.city, artist.state].filter(Boolean).join(", ");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Work detail"
    >
      <div className="relative grid max-h-[92dvh] w-full max-w-5xl overflow-hidden rounded-sm border border-border bg-surface-base shadow-lg lg:grid-cols-[1.15fr_1fr]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-sm bg-black/50 text-neutral-50 backdrop-blur-sm outline-none transition-colors hover:bg-black/70 focus-visible:ring-2 focus-visible:ring-brand"
        >
          <Icon name="x" size={18} />
        </button>

        {/* Artwork */}
        <div
          className="relative min-h-[40dvh] lg:min-h-full"
          style={{ background: artworkGradient(item.key, { ember: isFlash }) }}
        >
          {src && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={captionOf(item)} className="h-full max-h-[92dvh] w-full object-cover" />
          )}
          {isFlash && (
            <div className="absolute left-3 top-3">
              <FlashStamp />
            </div>
          )}
        </div>

        {/* Details */}
        <div className="flex max-h-[92dvh] flex-col gap-5 overflow-y-auto bg-surface-raised p-5 sm:p-6">
          {/* Artist row (right padding clears the absolute close button) */}
          <div className="flex items-center gap-3 pr-10 lg:pr-12">
            {handle ? (
              <Link
                href={`/a/${handle}`}
                className="group/artist flex min-w-0 items-center gap-3 outline-none"
              >
                <Avatar
                  src={artist.avatarUrl ?? undefined}
                  name={artist.displayName ?? handle}
                  size="md"
                  className="transition-opacity group-hover/artist:opacity-80"
                />
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-display text-base font-bold text-content-primary group-hover/artist:underline group-focus-visible/artist:underline">
                    {artist.displayName ?? "INKD artist"}
                  </span>
                  <span className="truncate font-mono text-xs uppercase tracking-[0.16em] text-content-muted">
                    {`@${handle}`}
                    {location ? " · " : ""}
                    {location}
                  </span>
                </div>
              </Link>
            ) : (
              <div className="flex min-w-0 items-center gap-3">
                <Avatar src={artist.avatarUrl ?? undefined} name={artist.displayName ?? "Artist"} size="md" />
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-display text-base font-bold text-content-primary">
                    {artist.displayName ?? "INKD artist"}
                  </span>
                  <span className="truncate font-mono text-xs uppercase tracking-[0.16em] text-content-muted">
                    {location}
                  </span>
                </div>
              </div>
            )}
            <button
              type="button"
              disabled={!signedIn}
              onClick={() => onToggleFollow(item)}
              className={cx(
                "ml-auto shrink-0 rounded-sm border px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-40",
                artist.isFollowedByViewer
                  ? "border-border bg-surface-overlay text-content-secondary hover:border-border-strong"
                  : "border-brand bg-brand text-brand-on hover:bg-brand-hover",
              )}
            >
              {artist.isFollowedByViewer ? "Following" : "Follow"}
            </button>
          </div>

          {/* Style chips */}
          {item.styleTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {item.styleTags.map((tag) => (
                <span
                  key={tag.id}
                  className="rounded-sm border border-border-subtle bg-surface-overlay px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-content-secondary"
                >
                  {tag.name}
                </span>
              ))}
            </div>
          )}

          {/* Flash meta / caption */}
          {isFlash ? (
            <div className="flex flex-col gap-3">
              {item.title && (
                <h2 className="font-display text-xl font-bold tracking-tight text-content-primary">
                  {item.title}
                </h2>
              )}
              <div className="flex items-center gap-3">
                <span className="font-hand text-4xl leading-none text-content-ember">
                  {flashPriceLabel(item.priceCents)}
                </span>
                <AvailabilityTag available={item.isAvailable} />
                {item.isRepeatable && (
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-content-muted">
                    Repeatable
                  </span>
                )}
              </div>
              <dl className="flex flex-wrap gap-x-6 gap-y-1 font-mono text-[11px] uppercase tracking-[0.14em] text-content-muted">
                {item.placementSuggestion && (
                  <div className="flex gap-2">
                    <dt>Placement</dt>
                    <dd className="text-content-secondary">{item.placementSuggestion}</dd>
                  </div>
                )}
                {item.sizeInches != null && (
                  <div className="flex gap-2">
                    <dt>Size</dt>
                    <dd className="text-content-secondary">{item.sizeInches}″</dd>
                  </div>
                )}
              </dl>
            </div>
          ) : (
            item.caption && (
              <p className="whitespace-pre-line text-sm leading-relaxed text-content-secondary">
                {item.caption}
              </p>
            )
          )}

          {/* Post actions */}
          {item.kind === "post" && (
            <div className="flex items-center gap-2">
              <ActionPill
                active={item.likedByViewer}
                disabled={!signedIn}
                onClick={() => onToggleLike(item)}
                activeClass="border-danger-500 text-danger-500"
              >
                <FeedGlyph name="heart" size={16} filled={item.likedByViewer} />
                {item.likeCount > 0 ? item.likeCount : "Like"}
              </ActionPill>
              <ActionPill
                active={item.savedByViewer}
                disabled={!signedIn}
                onClick={() => onToggleSave(item)}
                activeClass="border-brand text-content-accent"
              >
                <FeedGlyph name="bookmark" size={16} filled={item.savedByViewer} />
                {item.savedByViewer ? "Saved" : "Save"}
              </ActionPill>
            </div>
          )}

          {/* CTAs */}
          <div className="mt-auto flex flex-col gap-2 pt-2">
            {src && (
              <LinkButton href={tryOnHref(src)} size="md" variant="secondary">
                <Icon name="sparkles" size={16} />
                Try it on — fit check
              </LinkButton>
            )}
            {isFlash && handle && (
              <LinkButton href={`/book/${handle}`} size="md">
                Book this flash
                <Icon name="arrow-right" size={16} />
              </LinkButton>
            )}
            {handle ? (
              <LinkButton href={`/a/${handle}`} size="md" variant={isFlash ? "secondary" : "primary"}>
                View artist
                <Icon name="arrow-right" size={16} />
              </LinkButton>
            ) : (
              <Button size="md" variant="secondary" disabled>
                Artist profile unavailable
              </Button>
            )}
            {!signedIn && (
              <Link
                href="/auth"
                className="text-center font-mono text-[11px] uppercase tracking-[0.16em] text-content-muted underline-offset-4 hover:text-content-secondary hover:underline"
              >
                Sign in to like, save & follow
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionPill({
  active,
  disabled,
  onClick,
  activeClass,
  children,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  activeClass: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        "inline-flex items-center gap-1.5 rounded-sm border px-3 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-40",
        active ? activeClass : "border-border text-content-secondary hover:border-border-strong hover:text-content-primary",
      )}
    >
      {children}
    </button>
  );
}

function captionOf(item: FeedItem): string {
  if (item.kind === "flash") return item.title ?? "Flash design";
  return item.caption ?? "Tattoo work";
}
