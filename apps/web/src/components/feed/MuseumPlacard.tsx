import type { ReactNode } from "react";
import Link from "next/link";
import { cx } from "@inkd/ui/web";
import type { FeedArtist, FeedStyleTag } from "@inkd/core";
import { BooksSignal } from "./BooksSignal";

/**
 * The museum placard stamped beneath every piece: a solid ink strip carrying
 * the work's mono metadata — style(s) on top, artist handle · city below, with
 * the books-open signal and an optional right-aligned stamp (a flash price).
 * All-mono, uppercase, tracked: the printed-catalog voice.
 */
export function MuseumPlacard({
  artist,
  styleTags,
  stamp,
  className,
}: {
  artist: FeedArtist;
  styleTags: FeedStyleTag[];
  /** Right-aligned stamp — e.g. the ember flash price. */
  stamp?: ReactNode;
  className?: string;
}) {
  const styleLabel =
    styleTags.length > 0
      ? styleTags.slice(0, 2).map((s) => s.name).join(" · ")
      : "Tattoo";
  const location = [cityLabel(artist), artist.state].filter(Boolean).join(", ");

  return (
    <div
      className={cx(
        "flex items-start justify-between gap-3 border-t border-border-subtle bg-surface-raised px-3.5 py-2.5",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <span className="truncate font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-content-secondary">
          {styleLabel}
        </span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[11px] uppercase tracking-[0.16em] text-content-muted">
          {artist.handle ? (
            <Link
              href={`/a/${artist.handle}`}
              onClick={(event) => event.stopPropagation()}
              className="truncate text-content-muted underline-offset-2 outline-none transition-colors hover:text-content-primary hover:underline focus-visible:text-content-primary focus-visible:underline"
            >
              {handleLabel(artist)}
            </Link>
          ) : (
            <span className="truncate">{handleLabel(artist)}</span>
          )}
          {location && <span aria-hidden>·</span>}
          {location && <span className="truncate">{location}</span>}
        </span>
        <BooksSignal open={artist.acceptsNewClients} className="mt-0.5" />
      </div>
      {stamp && <div className="shrink-0 pt-0.5">{stamp}</div>}
    </div>
  );
}

function handleLabel(artist: FeedArtist): string {
  if (artist.handle) return `@${artist.handle}`;
  return artist.displayName ?? "INKD artist";
}

function cityLabel(artist: FeedArtist): string {
  return artist.city ?? "";
}
