"use client";

import { useState } from "react";
import { cx } from "@inkd/ui/web";
import type { FeedItem, FeedPostItem, FeedFlashItem } from "@inkd/core";
import { flashPriceLabel } from "@/lib/format";
import { artworkGradient } from "./artwork";
import { FeedGlyph } from "./FeedGlyph";
import { FlashStamp } from "./FlashStamp";
import { MuseumPlacard } from "./MuseumPlacard";

export interface FeedCardProps {
  item: FeedItem;
  signedIn: boolean;
  onOpen: (item: FeedItem) => void;
  onToggleLike: (item: FeedPostItem) => void;
  onToggleSave: (item: FeedPostItem) => void;
}

export function FeedCard(props: FeedCardProps) {
  return props.item.kind === "post" ? (
    <PostCard {...props} item={props.item} />
  ) : (
    <FlashCard {...props} item={props.item} />
  );
}

// --- shared artwork frame ---------------------------------------------------
function Artwork({
  seed,
  src,
  alt,
  ember,
  children,
}: {
  seed: string;
  src: string | null;
  alt: string;
  ember?: boolean;
  children?: React.ReactNode;
}) {
  const [broken, setBroken] = useState(false);
  return (
    <div
      className="relative aspect-[4/5] w-full overflow-hidden"
      style={{ background: artworkGradient(seed, { ember }) }}
    >
      {src && !broken && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onError={() => setBroken(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      {children}
    </div>
  );
}

function CardShell({
  onOpen,
  label,
  children,
}: {
  onOpen: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <article className="group overflow-hidden rounded-sm border border-border-subtle bg-surface-base transition-colors duration-[180ms] hover:border-border-accent">
      <button
        type="button"
        onClick={onOpen}
        aria-label={label}
        className="block w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base"
      >
        {children}
      </button>
    </article>
  );
}

// --- post -------------------------------------------------------------------
function PostCard({
  item,
  signedIn,
  onOpen,
  onToggleLike,
  onToggleSave,
}: FeedCardProps & { item: FeedPostItem }) {
  const artist = item.artist;
  return (
    <CardShell
      onOpen={() => onOpen(item)}
      label={`Open work by ${artist.handle ? `@${artist.handle}` : artist.displayName ?? "artist"}`}
    >
      <Artwork seed={item.key} src={item.coverUrl} alt={item.caption ?? "Tattoo work"}>
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-end gap-1.5 bg-gradient-to-t from-black/55 to-transparent p-2.5">
          <ActionButton
            active={item.likedByViewer}
            disabled={!signedIn}
            onClick={() => onToggleLike(item)}
            label={item.likedByViewer ? "Unlike" : "Like"}
            activeClass="text-danger-500"
          >
            <FeedGlyph name="heart" size={16} filled={item.likedByViewer} />
            {item.likeCount > 0 && (
              <span className="font-mono text-[11px] tabular-nums">{item.likeCount}</span>
            )}
          </ActionButton>
          <ActionButton
            active={item.savedByViewer}
            disabled={!signedIn}
            onClick={() => onToggleSave(item)}
            label={item.savedByViewer ? "Remove from saved" : "Save for later"}
            activeClass="text-content-accent"
          >
            <FeedGlyph name="bookmark" size={16} filled={item.savedByViewer} />
          </ActionButton>
        </div>
      </Artwork>
      <MuseumPlacard artist={artist} styleTags={item.styleTags} />
    </CardShell>
  );
}

// --- flash ------------------------------------------------------------------
function FlashCard({ item, onOpen }: FeedCardProps & { item: FeedFlashItem }) {
  const artist = item.artist;
  return (
    <CardShell
      onOpen={() => onOpen(item)}
      label={`Open flash${item.title ? ` "${item.title}"` : ""} by ${artist.handle ? `@${artist.handle}` : artist.displayName ?? "artist"}`}
    >
      <Artwork seed={item.key} src={item.imageUrl} alt={item.title ?? "Flash design"} ember>
        <div className="absolute left-2.5 top-2.5">
          <FlashStamp />
        </div>
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/60 to-transparent p-2.5">
          <span className="font-hand text-2xl leading-none text-content-ember">
            {flashPriceLabel(item.priceCents)}
          </span>
          <AvailabilityTag available={item.isAvailable} />
        </div>
      </Artwork>
      <MuseumPlacard artist={artist} styleTags={item.styleTags} />
    </CardShell>
  );
}

export function AvailabilityTag({ available }: { available: boolean }) {
  return (
    <span
      className={cx(
        "rounded-sm px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em]",
        available
          ? "bg-surface-overlay text-content-secondary"
          : "bg-surface-overlay text-content-muted line-through",
      )}
    >
      {available ? "Available" : "Claimed"}
    </span>
  );
}

function ActionButton({
  active,
  disabled,
  onClick,
  label,
  activeClass,
  children,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  label: string;
  activeClass: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={active}
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        if (!disabled) onClick();
      }}
      className={cx(
        "inline-flex items-center gap-1 rounded-sm bg-black/45 px-2 py-1.5 backdrop-blur-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-40",
        active ? activeClass : "text-neutral-50 hover:text-white",
      )}
    >
      {children}
    </button>
  );
}
