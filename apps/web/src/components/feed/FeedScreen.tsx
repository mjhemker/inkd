"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Eyebrow, Icon, LogoDropMark, Skeleton, cx } from "@inkd/ui/web";
import {
  useCurrentProfile,
  useFeedItems,
  useStyleFilters,
  useToggleFollow,
  useToggleLike,
  useToggleSave,
  useTodayDropLive,
  todayDropDate,
  queryToFeedFilter,
  feedFilterToQuery,
  EMPTY_FEED_FILTER,
  feedArtistFilterParams,
  describeFeedFilters,
  clearFeedFilterChip,
  hasActiveFeedFilters,
  activeFeedFilterCount,
  type FeedFilterState,
  type FeedItem,
  type FeedPostItem,
  type FeedScope,
} from "@inkd/core";
import { FeedCard } from "./FeedCard";
import { FeedFilterPanel } from "./FeedFilterPanel";
import { PostDetailOverlay } from "./PostDetailOverlay";
import { DailyDropCard } from "@/components/daily-drop/DailyDropCard";
import {
  DailyDropReveal,
  hasRevealedDailyDrop,
  markDailyDropRevealed,
} from "@/components/daily-drop/DailyDropReveal";

// Label is "Explore" (not "Discover") so this subtab doesn't collide with the
// Discover nav tab; the scope VALUE stays "discover" so URL/query-key state
// (feedQueryKeys, cached queries, etc.) is untouched.
const SCOPES: { value: FeedScope; label: string }[] = [
  { value: "discover", label: "Explore" },
  { value: "following", label: "Following" },
];

/**
 * INKD's discovery feed — the brand-defining consumer surface. A printed
 * art-catalog: a strict grid of framed pieces, each under a mono museum
 * placard, flash drops stamped in ember. Discover ranks newest-first with a
 * light style-affinity boost; Following is your own wall.
 */
export function FeedScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [scope, setScope] = useState<FeedScope>("discover");
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Filter state lives in the URL (shareable / back-button-safe). The Filters
  // panel is the single entry point for editing it.
  const filter = useMemo(
    () => queryToFeedFilter((k) => searchParams.get(k)),
    [searchParams],
  );
  const setFilter = (next: FeedFilterState) => {
    const qs = feedFilterToQuery(next);
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const { data: profile, isLoading: profileLoading } = useCurrentProfile();
  const signedIn = Boolean(profile);

  const { data: styles } = useStyleFilters();
  const drop = useTodayDropLive();

  const artistFilters = useMemo(() => feedArtistFilterParams(filter), [filter]);
  const feed = useFeedItems(scope, { styleSlugs: filter.styles, styleQuery: filter.styleQuery, artistFilters });

  // First feed visit of the day → the full-screen reveal takeover (once, then it
  // lives on as the highlighted card below). Gated by a localStorage date stamp.
  const dropDate = todayDropDate();
  const [revealDismissed, setRevealDismissed] = useState(true);
  useEffect(() => {
    // Read localStorage on the client only (avoids an SSR/hydration mismatch).
    setRevealDismissed(hasRevealedDailyDrop(dropDate));
  }, [dropDate]);
  const showReveal = scope === "discover" && drop.status === "ready" && !!drop.card && !revealDismissed;
  const like = useToggleLike();
  const save = useToggleSave();
  const follow = useToggleFollow();

  const activeChips = useMemo(
    () => describeFeedFilters(filter, styles ?? []),
    [filter, styles],
  );

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
          {/* Scope switch (Explore/Following) + Filters — the single filter
              entry point, right beside the tabs it governs. */}
          <div className="flex items-center justify-between gap-3">
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

            <div className="relative shrink-0">
              <button
                type="button"
                aria-haspopup="dialog"
                aria-expanded={filtersOpen}
                onClick={() => setFiltersOpen((v) => !v)}
                className={cx(
                  "inline-flex items-center gap-1.5 rounded-sm border px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand",
                  hasActiveFeedFilters(filter)
                    ? "border-brand bg-brand/10 text-content-primary"
                    : "border-border-subtle bg-surface-raised text-content-secondary hover:border-border-strong hover:text-content-primary",
                )}
              >
                <Icon name="settings" size={13} />
                Filters
                {activeFeedFilterCount(filter) > 0 && (
                  <span className="grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold text-brand-on">
                    {activeFeedFilterCount(filter)}
                  </span>
                )}
              </button>
              {filtersOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    aria-hidden
                    onClick={() => setFiltersOpen(false)}
                  />
                  <div className="absolute right-0 top-full z-50 mt-2">
                    <FeedFilterPanel
                      filter={filter}
                      styles={styles ?? []}
                      onChange={setFilter}
                      onReset={() => setFilter(EMPTY_FEED_FILTER)}
                      onClose={() => setFiltersOpen(false)}
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Active-filter chips (inline, with clear-all) */}
          {activeChips.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {activeChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => setFilter(clearFeedFilterChip(filter, chip))}
                  className="inline-flex items-center gap-1 rounded-sm border border-brand/40 bg-brand/10 px-2 py-1 text-xs font-medium text-content-primary outline-none transition-colors hover:border-brand focus-visible:ring-2 focus-visible:ring-brand"
                >
                  {chip.label}
                  <Icon name="x" size={12} className="text-content-muted" />
                </button>
              ))}
              <button
                type="button"
                onClick={() => setFilter(EMPTY_FEED_FILTER)}
                className="ml-1 font-mono text-[11px] uppercase tracking-wider text-content-muted outline-none hover:text-content-primary focus-visible:ring-2 focus-visible:ring-brand"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      </header>

      {showReveal && drop.card && (
        <DailyDropReveal
          card={drop.card}
          onDismiss={() => {
            markDailyDropRevealed(dropDate);
            setRevealDismissed(true);
          }}
        />
      )}

      {scope === "discover" && (drop.card || drop.status === "generating") && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-content-ember">
              Today&apos;s drop
            </span>
            {drop.card && (
              <a
                href="/daily-drop"
                className="font-mono text-[11px] uppercase tracking-[0.16em] text-content-muted underline-offset-2 outline-none hover:text-content-primary hover:underline focus-visible:ring-2 focus-visible:ring-brand"
              >
                See all
              </a>
            )}
          </div>
          {drop.card ? (
            <DailyDropCard card={drop.card} variant="feed" signedIn={signedIn} />
          ) : (
            <DailyDropGeneratingCard />
          )}
        </div>
      )}

      {loading ? (
        <FeedSkeletonGrid />
      ) : items.length === 0 ? (
        <FeedEmptyState
          scope={scope}
          styleActive={hasActiveFeedFilters(filter)}
          onClearStyle={() => setFilter(EMPTY_FEED_FILTER)}
        />
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

/** The "we're picking your drop" progression, shown while on-demand generation
 *  runs for a user who opened the app before their drop existed. */
function DailyDropGeneratingCard() {
  return (
    <div className="flex items-center gap-4 overflow-hidden rounded-sm border border-border-accent bg-surface-base p-4 sm:p-5">
      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-sm bg-surface-ember/15">
        <LogoDropMark size={40} />
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-content-ember">
          Picking your drop
        </span>
        <p className="font-hand text-xl leading-tight text-content-primary">
          Finding today&apos;s piece for you…
        </p>
        <div className="mt-1 flex gap-1.5" aria-hidden>
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-content-ember [animation-delay:0ms]" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-content-ember [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-content-ember [animation-delay:300ms]" />
        </div>
      </div>
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
