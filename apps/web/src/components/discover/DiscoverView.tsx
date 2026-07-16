"use client";

/**
 * /discover — the local map + list hybrid (SPEC §4). Filter state lives in the
 * URL (shareable), drives the `search_artists` RPC via `useDiscover`, and the
 * result list stays synced to the map viewport. The map is loaded client-only
 * (MapLibre touches `window`), so it is dynamically imported with ssr:false.
 */
import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Eyebrow, Icon, Spinner, cx } from "@inkd/ui/web";
import { useDiscover, useStyles } from "@inkd/core/hooks";
import {
  discoverFilterToParams,
  discoverFilterToQuery,
  queryToDiscoverFilter,
  EMPTY_FILTER_STATE,
  type DiscoverFilterState,
} from "@inkd/core/api";

import { FilterBar } from "./FilterBar";
import { ArtistPlacard } from "./ArtistPlacard";
import { ShopStrip } from "./ShopStrip";

const DiscoverMap = dynamic(
  () => import("./DiscoverMap").then((m) => m.DiscoverMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-surface-raised">
        <Spinner />
      </div>
    ),
  },
);

type MobileView = "list" | "map";

export function DiscoverView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filter = useMemo(
    () => queryToDiscoverFilter((k) => searchParams.get(k)),
    [searchParams],
  );
  const params = useMemo(() => discoverFilterToParams(filter), [filter]);

  const { data: cards = [], isLoading, isFetching } = useDiscover(params);
  const { data: styles = [] } = useStyles();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [visibleIds, setVisibleIds] = useState<Set<string> | null>(null);
  const [mobileView, setMobileView] = useState<MobileView>("list");

  const center =
    filter.lat != null && filter.lng != null
      ? { lat: filter.lat, lng: filter.lng }
      : null;

  const setFilter = (next: DiscoverFilterState) => {
    const qs = discoverFilterToQuery(next);
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  // The list mirrors the map viewport: once the map reports visible pins, hide
  // out-of-view artists. Artists without coordinates are always listed.
  const listCards = useMemo(() => {
    if (!visibleIds) return cards;
    return cards.filter((c) => c.lat == null || visibleIds.has(c.artist_id));
  }, [cards, visibleIds]);

  return (
    <div className="mx-auto flex h-[calc(100dvh-9rem)] min-h-[36rem] w-full max-w-6xl flex-col gap-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <Eyebrow>Discover</Eyebrow>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-content-primary">
            Find your artist
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {isFetching && !isLoading && <Spinner size={16} />}
          <Link
            href="/discover/match"
            className="inline-flex items-center gap-2 rounded-lg bg-surface-ember px-3.5 py-2 font-mono text-xs font-bold uppercase tracking-widest text-brand-on-ember transition-opacity hover:opacity-90"
          >
            <Icon name="image" size={15} />
            <span className="hidden sm:inline">Match my inspiration</span>
            <span className="sm:hidden">Match photo</span>
          </Link>
        </div>
      </header>

      <FilterBar
        filter={filter}
        styles={styles}
        resultCount={cards.length}
        onChange={setFilter}
        onReset={() => setFilter(EMPTY_FILTER_STATE)}
      />

      {/* Mobile view toggle */}
      <div className="flex gap-2 lg:hidden">
        {(["list", "map"] as MobileView[]).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setMobileView(v)}
            className={cx(
              "flex-1 rounded-sm border px-3 py-2 font-mono text-xs font-semibold uppercase tracking-widest transition-colors",
              mobileView === v
                ? "border-brand bg-brand text-brand-on"
                : "border-border-subtle bg-surface-raised text-content-secondary",
            )}
          >
            <span className="inline-flex items-center gap-1.5">
              <Icon name={v === "list" ? "layout-grid" : "map-pin"} size={13} /> {v}
            </span>
          </button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        {/* List */}
        <section
          className={cx(
            "min-h-0 flex-col overflow-y-auto pr-1",
            mobileView === "list" ? "flex" : "hidden",
            "lg:flex",
          )}
        >
          <div className="flex flex-col gap-3">
            <ShopStrip state={filter.state} query={filter.query} />
            {isLoading ? (
              <div className="flex flex-1 items-center justify-center py-16">
                <Spinner />
              </div>
            ) : listCards.length === 0 ? (
              <EmptyResults hasFilters={cards.length === 0} />
            ) : (
              listCards.map((c) => (
                <ArtistPlacard
                  key={c.artist_id}
                  card={c}
                  active={activeId === c.artist_id}
                  onHover={setActiveId}
                />
              ))
            )}
          </div>
        </section>

        {/* Map */}
        <section
          className={cx(
            "min-h-[320px] overflow-hidden rounded-sm border border-border-subtle",
            mobileView === "map" ? "block" : "hidden",
            "lg:block",
          )}
        >
          <DiscoverMap
            cards={cards}
            center={center}
            activeId={activeId}
            onHoverPin={setActiveId}
            onVisibleChange={(ids) => setVisibleIds(new Set(ids))}
            className="h-full w-full"
          />
        </section>
      </div>
    </div>
  );
}

function EmptyResults({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-center">
      <span className="text-content-muted">
        <Icon name="search" size={28} />
      </span>
      <p className="font-display text-lg font-bold text-content-primary">
        {hasFilters ? "No artists match these filters" : "Nothing in view"}
      </p>
      <p className="max-w-xs text-sm text-content-secondary">
        {hasFilters
          ? "Try widening the distance, clearing a style, or a different price band."
          : "Pan or zoom the map to bring artists back into the list."}
      </p>
    </div>
  );
}
