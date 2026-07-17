"use client";

/**
 * One matched artist, rendered as a curated gallery placard (not a search row):
 * the artist's identity + a similarity indicator + a plain-language match reason
 * ("Fine line + floral, like your inspiration"), over a strip of their closest
 * pieces. The card links to /a/[handle]; each piece deep-links into the profile.
 */
import Link from "next/link";
import { Avatar, Icon, cx } from "@inkd/ui/web";
import {
  workHref,
  STRONG_MATCH_THRESHOLD,
  CLOSE_MATCH_THRESHOLD,
  type MatchArtistGroup,
  type MatchWork,
} from "@inkd/core/api";

export interface MatchArtistCardProps {
  group: MatchArtistGroup;
  className?: string;
}

export function MatchArtistCard({ group, className }: MatchArtistCardProps) {
  const Wrapper = group.profileHref ? Link : "div";
  const wrapperProps = group.profileHref ? { href: group.profileHref } : {};

  return (
    <div
      className={cx(
        "group flex flex-col overflow-hidden rounded-sm border border-border-subtle bg-surface-raised transition-colors hover:border-border-strong",
        className,
      )}
    >
      {/* Header: identity + match indicator */}
      <div className="flex items-start gap-3 p-4 pb-3">
        <Avatar
          src={group.avatarUrl ?? undefined}
          name={group.displayName}
          size="lg"
          shape="square"
        />
        <div className="min-w-0 flex-1">
          <Wrapper
            {...(wrapperProps as { href: string })}
            className="min-w-0 outline-none focus-visible:underline"
          >
            <h3 className="truncate font-display text-lg font-bold tracking-tight text-content-primary">
              {group.displayName}
            </h3>
            {group.handle && (
              <p className="truncate font-mono text-xs text-content-muted">
                @{group.handle}
              </p>
            )}
          </Wrapper>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-content-secondary">
            <span className="text-content-ember">
              <Icon name="sparkles" size={13} />
            </span>
            <span className="truncate">{group.matchReason}</span>
          </p>
        </div>
        {group.isAffinityFallback ? (
          <span className="shrink-0 self-start rounded-sm border border-border-subtle bg-surface-overlay px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest text-content-muted">
            Nearby
          </span>
        ) : (
          <MatchMeter
            percent={group.topSimilarityPercent}
            label={group.matchLabel}
            similarity={group.topSimilarity}
          />
        )}
      </div>

      {/* Pieces strip */}
      {group.works.length > 0 && (
        <div className="grid grid-cols-4 gap-0.5 px-0.5 pb-0.5">
          {group.works.map((w) => (
            <WorkThumb key={w.subjectId} handle={group.handle} work={w} />
          ))}
        </div>
      )}

      {/* Footer CTA */}
      {group.profileHref && (
        <Link
          href={group.profileHref}
          className="flex items-center justify-between px-4 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-widest text-content-secondary transition-colors hover:text-content-primary"
        >
          View portfolio
          <Icon name="arrow-right" size={14} />
        </Link>
      )}
    </div>
  );
}

function WorkThumb({ handle, work }: { handle: string | null; work: MatchWork }) {
  const href = workHref(handle, work);
  const inner = (
    <div className="relative aspect-square overflow-hidden bg-surface-overlay">
      {work.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={work.imageUrl}
          alt={work.styles.map(titleCase).join(", ") || "Matched tattoo"}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          loading="lazy"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-content-muted">
          <Icon name="image" size={18} />
        </div>
      )}
      {work.similarityPercent > 0 && (
        <span className="absolute bottom-1 right-1 rounded-sm bg-surface-base/85 px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums text-content-primary backdrop-blur-sm">
          {work.similarityPercent}%
        </span>
      )}
    </div>
  );
  return href ? (
    <Link href={href} className="outline-none focus-visible:opacity-80">
      {inner}
    </Link>
  ) : (
    inner
  );
}

/** A compact circular-ish strength indicator: percent + strength word. */
function MatchMeter({
  percent,
  label,
  similarity,
}: {
  percent: number;
  label: string;
  similarity: number;
}) {
  const tone =
    similarity >= STRONG_MATCH_THRESHOLD
      ? "text-content-ember"
      : similarity >= CLOSE_MATCH_THRESHOLD
        ? "text-content-primary"
        : "text-content-secondary";
  return (
    <div className="flex shrink-0 flex-col items-end">
      <span className={cx("font-hand text-2xl leading-none", tone)}>{percent}%</span>
      <span className="mt-0.5 font-mono text-[9px] font-bold uppercase tracking-widest text-content-muted">
        {label}
      </span>
    </div>
  );
}

function titleCase(s: string): string {
  return s
    .split(/[\s_-]+/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}
