"use client";

/**
 * The ranked results — a curated gallery of matched artists, grouped, with the
 * realistic edge cases handled inline:
 *   - no_style : the image had no readable aesthetic → try another / browse
 *   - no_match : a clear style but zero artists → closest styles + browse CTA
 *   - low_match: only weak matches → show them, framed as "closest we found"
 */
import Link from "next/link";
import { Icon } from "@inkd/ui/web";
import type { MatchArtistGroup, MatchOutcome, InspirationSummary } from "@inkd/core/api";

import { MatchArtistCard } from "./MatchArtistCard";

export interface MatchResultsGalleryProps {
  outcome: MatchOutcome;
  groups: MatchArtistGroup[];
  summary: InspirationSummary;
  /** Called when the user wants to start over with a different image. */
  onTryAnother: () => void;
}

/** Browse-by-style link for the detected (or closest) styles. */
function browseStylesHref(summary: InspirationSummary): string {
  const slugs = summary.styles.slice(0, 3).map((s) => s.slug);
  return slugs.length ? `/discover?styles=${slugs.join(",")}` : "/discover";
}

export function MatchResultsGallery({
  outcome,
  groups,
  summary,
  onTryAnother,
}: MatchResultsGalleryProps) {
  if (outcome === "no_style") {
    return (
      <Fallback
        icon="search"
        title="We couldn't read a clear style"
        body="This image didn't show a distinct tattoo aesthetic we could match on. Try a clearer photo of a tattoo, or browse artists by style."
      >
        <div className="flex flex-wrap justify-center gap-2">
          <RetryButton onClick={onTryAnother} />
          <BrowseButton href="/discover" />
        </div>
      </Fallback>
    );
  }

  // `no_match` only reaches here when even the style-affinity fallback found no
  // artists at all (empty pool) — a true dead end. Otherwise the run layer
  // substitutes fallback groups and sets outcome "fallback" (handled below).
  if (outcome === "no_match") {
    return (
      <Fallback
        icon="sparkles"
        title="No artists match this vibe yet"
        body={`We read this as ${summary.styles
          .slice(0, 2)
          .map((s) => s.label)
          .join(" + ") || "a distinct style"}, but no artist in your area has work like it right now. Browse the closest styles instead.`}
      >
        <div className="flex flex-wrap justify-center gap-2">
          <BrowseButton href={browseStylesHref(summary)} label="Browse these styles" />
          <RetryButton onClick={onTryAnother} />
        </div>
      </Fallback>
    );
  }

  const isFallback = outcome === "fallback";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-mono text-xs uppercase tracking-wider text-content-secondary">
          {isFallback
            ? `${groups.length} ${groups.length === 1 ? "artist" : "artists"} nearby`
            : `${groups.length} ${groups.length === 1 ? "artist" : "artists"} match your inspiration`}
        </p>
        {(outcome === "low_match" || isFallback) && (
          <span className="font-mono text-[10px] uppercase tracking-widest text-content-muted">
            {isFallback ? "Who's nearby" : "Closest we found"}
          </span>
        )}
      </div>

      {isFallback && (
        <p className="rounded-sm border border-border-subtle bg-surface-overlay px-3 py-2 text-xs text-content-secondary">
          No close visual match yet — here are the closest artists by style. Try{" "}
          <button
            type="button"
            onClick={onTryAnother}
            className="text-content-ember underline"
          >
            another image
          </button>{" "}
          or{" "}
          <Link href={browseStylesHref(summary)} className="text-content-ember underline">
            browse by style
          </Link>
          .
        </p>
      )}

      {outcome === "low_match" && (
        <p className="rounded-sm border border-border-subtle bg-surface-overlay px-3 py-2 text-xs text-content-secondary">
          These are the nearest matches — none is a strong hit. You can{" "}
          <Link href={browseStylesHref(summary)} className="text-content-ember underline">
            browse by style
          </Link>{" "}
          or try a different image.
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {groups.map((g) => (
          <MatchArtistCard key={g.artistId} group={g} />
        ))}
      </div>
    </div>
  );
}

function Fallback({
  icon,
  title,
  body,
  children,
}: {
  icon: "search" | "sparkles";
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-sm border border-dashed border-border-default bg-surface-raised px-6 py-12 text-center">
      <span className="text-content-muted">
        <Icon name={icon} size={30} />
      </span>
      <h3 className="font-display text-lg font-bold text-content-primary">{title}</h3>
      <p className="max-w-md text-sm text-content-secondary">{body}</p>
      {children}
    </div>
  );
}

function RetryButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border-strong px-4 py-2 text-sm font-semibold text-content-primary transition-colors hover:bg-surface-overlay"
    >
      <Icon name="image" size={15} /> Try another image
    </button>
  );
}

function BrowseButton({ href, label = "Browse by style" }: { href: string; label?: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-on transition-colors hover:opacity-90"
    >
      <Icon name="compass" size={15} /> {label}
    </Link>
  );
}
