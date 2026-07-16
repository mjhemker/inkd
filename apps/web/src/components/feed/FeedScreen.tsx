"use client";

import { useMemo, useState } from "react";
import { Eyebrow, Icon, Skeleton, cx } from "@inkd/ui/web";
import {
  useCurrentProfile,
  useFeedItems,
  useStyleFilters,
  useToggleFollow,
  useToggleLike,
  useToggleSave,
  type FeedItem,
  type FeedPostItem,
  type FeedScope,
} from "@inkd/core";
import { FeedCard } from "./FeedCard";
import { StyleFilterChips } from "./StyleFilterChips";
import { PostDetailOverlay } from "./PostDetailOverlay";

const SCOPES: { value: FeedScope; label: string }[] = [
  { value: "discover", label: "Discover" },
  { value: "following", label: "Following" },
];

/**
 * INKD's discovery feed — the brand-defining consumer surface. A printed
 * art-catalog: a strict grid of framed pieces, each under a mono museum
 * placard, flash drops stamped in ember. Discover ranks newest-first with a
 * light style-affinity boost; Following is your own wall.
 */
export function FeedScreen() {
  const [scope, setScope] = useState<FeedScope>("discover");
  const [styleSlug, setStyleSlug] = useState<string | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);

  const { data: profile, isLoading: profileLoading } = useCurrentProfile();
  const signedIn = Boolean(profile);

  const { data: styles } = useStyleFilters();
  const feed = useFeedItems(scope, { styleSlug });
  const like = useToggleLike();
  const save = useToggleSave();
  const follow = useToggleFollow();

  const items = feed.items;
  const openItem = useMemo(
    () => items.find((i) => i.key === openKey) ?? null,
    [items, openKey],
  );

  const toggleLike = (item: FeedItem) => {
    if (item.kind !== "post") return;
    like.mutate({ postId: item.id, liked: !item.likedByViewer });
  };
  const toggleSave = (item: FeedItem) => {
    if (item.kind !== "post") return;
    save.mutate({ postId: item.id, saved: !item.savedByViewer });
  };
  const toggleFollow = (item: FeedItem) => {
    follow.mutate({
      artistId: item.artist.artistId,
      followed: !item.artist.isFollowedByViewer,
    });
  };

  const loading = profileLoading || (feed.isLoading && items.length === 0);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Eyebrow>INKD · the wall</Eyebrow>
          <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
            New work
          </h1>
        </div>

        <div className="flex flex-col gap-4">
          {/* Scope switch — two hard placard tabs */}
          <div
            className="inline-flex w-fit gap-1 rounded-sm border border-border-subtle bg-surface-raised p-1"
            role="tablist"
            aria-label="Feed scope"
          >
            {SCOPES.map((s) => {
              const active = scope === s.value;
              return (
                <button
                  key={s.value}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setScope(s.value)}
                  className={cx(
                    "rounded-sm px-4 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand",
                    active
                      ? "bg-brand text-brand-on"
                      : "text-content-muted hover:text-content-primary",
                  )}
                >
                  {s.label}
                </button>
              );
            })}
          </div>

          {styles && styles.length > 0 && (
            <StyleFilterChips styles={styles} selected={styleSlug} onSelect={setStyleSlug} />
          )}
        </div>
      </header>

      {loading ? (
        <FeedSkeletonGrid />
      ) : items.length === 0 ? (
        <FeedEmptyState scope={scope} styleActive={styleSlug !== null} onClearStyle={() => setStyleSlug(null)} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <FeedCard
                key={item.key}
                item={item}
                signedIn={signedIn}
                onOpen={(i) => setOpenKey(i.key)}
                onToggleLike={(i: FeedPostItem) => toggleLike(i)}
                onToggleSave={(i: FeedPostItem) => toggleSave(i)}
              />
            ))}
          </div>

          {feed.hasNextPage && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={() => feed.fetchNextPage()}
                disabled={feed.isFetchingNextPage}
                className="rounded-sm border border-border bg-surface-raised px-5 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-content-secondary outline-none transition-colors hover:border-border-strong hover:text-content-primary focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50"
              >
                {feed.isFetchingNextPage ? "Loading…" : "More work"}
              </button>
            </div>
          )}
        </>
      )}

      {openItem && (
        <PostDetailOverlay
          item={openItem}
          signedIn={signedIn}
          onClose={() => setOpenKey(null)}
          onToggleLike={toggleLike}
          onToggleSave={toggleSave}
          onToggleFollow={toggleFollow}
        />
      )}
    </div>
  );
}

function FeedSkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-sm border border-border-subtle">
          <Skeleton className="aspect-[4/5] w-full rounded-none" />
          <div className="flex flex-col gap-2 bg-surface-raised px-3.5 py-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
      ))}
    </div>
  );
}

function FeedEmptyState({
  scope,
  styleActive,
  onClearStyle,
}: {
  scope: FeedScope;
  styleActive: boolean;
  onClearStyle: () => void;
}) {
  const note =
    scope === "following"
      ? "nothing here yet — go follow some artists"
      : styleActive
        ? "no work in this style yet — try another"
        : "the wall's still being hung";

  return (
    <div className="flex flex-col items-center gap-5 rounded-sm border border-dashed border-border bg-surface-raised px-6 py-16 text-center">
      <p className="-rotate-2 font-hand text-3xl leading-tight text-content-ember">{note}</p>
      <p className="max-w-sm text-sm text-content-secondary">
        {scope === "following"
          ? "Follow artists whose work you love and their newest pieces — flash, healed shots and open books — land right here."
          : "Fresh ink drops in daily. Check back soon, or widen your filters to see more of the wall."}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {scope === "following" && (
          <a
            href="/discover"
            className="rounded-sm bg-brand px-4 py-2 font-sans text-sm font-semibold text-brand-on outline-none transition-colors hover:bg-brand-hover focus-visible:ring-2 focus-visible:ring-brand"
          >
            Discover artists
          </a>
        )}
        {styleActive && (
          <button
            type="button"
            onClick={onClearStyle}
            className="rounded-sm border border-border px-4 py-2 font-sans text-sm font-medium text-content-secondary outline-none transition-colors hover:border-border-strong hover:text-content-primary focus-visible:ring-2 focus-visible:ring-brand"
          >
            Clear filter
          </button>
        )}
      </div>

      {/* Tools: match my inspiration — image-based artist discovery. */}
      <a
        href="/discover/match"
        className="mt-2 flex w-full max-w-sm items-center gap-3 rounded-sm border border-border-subtle bg-surface-overlay px-4 py-3 text-left outline-none transition-colors hover:border-border-strong focus-visible:ring-2 focus-visible:ring-brand"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-sm border border-border-subtle bg-surface-base text-content-ember">
          <Icon name="image" size={16} />
        </span>
        <span className="flex flex-col">
          <span className="text-sm font-semibold text-content-primary">Match my inspiration</span>
          <span className="text-xs text-content-muted">
            Upload a tattoo you love — find artists whose work matches that vibe.
          </span>
        </span>
      </a>

      {/* Tools: photo-based fit check — a client-facing utility, no account needed. */}
      <a
        href="/try-on"
        className="mt-2 flex w-full max-w-sm items-center gap-3 rounded-sm border border-border-subtle bg-surface-overlay px-4 py-3 text-left outline-none transition-colors hover:border-border-strong focus-visible:ring-2 focus-visible:ring-brand"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-sm border border-border-subtle bg-surface-base text-content-accent">
          <Icon name="sparkles" size={16} />
        </span>
        <span className="flex flex-col">
          <span className="text-sm font-semibold text-content-primary">Try a design on</span>
          <span className="text-xs text-content-muted">
            Photo-based fit check — size &amp; place it on your own photo. Not AR, not a prediction.
          </span>
        </span>
      </a>
    </div>
  );
}
