"use client";

/**
 * Offline dev harness for /discover. Renders the real FilterBar + ArtistPlacard
 * + DiscoverMap against seeded artist cards with a local re-implementation of
 * the `search_artists` filter/sort semantics — no live Supabase needed. Lets us
 * build and screenshot the discovery surface in isolation. (Map tiles still
 * come from the OpenFreeMap CDN; if egress is blocked the list + filters render
 * regardless.) Not linked from product nav.
 */
import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  formatMinPrice,
  usdToCents,
  PRICE_SLIDER_MIN_USD,
  PRICE_SLIDER_MAX_USD,
  EMPTY_FILTER_STATE,
  type ArtistCard,
  type DiscoverFilterState,
} from "@inkd/core/api";
import type { Style } from "@inkd/core/types";
import { Spinner } from "@inkd/ui/web";

import { FilterBar } from "@/components/discover/FilterBar";
import { ArtistPlacard } from "@/components/discover/ArtistPlacard";

// Same pattern as the real /discover (DiscoverView): MapLibre touches
// `window`, so it's loaded client-only and only when the map actually renders
// — this dev harness was pulling the ~190kB maplibre-gl chunk into its
// synchronous bundle for no reason (not linked from product nav, but built).
const DiscoverMap = dynamic(
  () => import("@/components/discover/DiscoverMap").then((m) => m.DiscoverMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-surface-raised">
        <Spinner />
      </div>
    ),
  },
);

const STYLE_SEED: [string, string][] = [
  ["american-traditional", "American Traditional"],
  ["neo-traditional", "Neo-Traditional"],
  ["japanese-irezumi", "Japanese / Irezumi"],
  ["fine-line", "Fine Line"],
  ["blackwork", "Blackwork"],
  ["realism", "Realism"],
  ["black-and-grey", "Black & Grey"],
  ["portrait", "Portrait"],
  ["micro-realism", "Micro-Realism"],
  ["minimalist", "Minimalist"],
  ["ornamental", "Ornamental"],
  ["floral-botanical", "Floral / Botanical"],
];
const STYLES: Style[] = STYLE_SEED.map(([slug, name], i) => ({
  id: slug,
  slug,
  name,
  category: null,
  description: null,
  sort_order: i * 10,
  created_at: "",
}));

function card(c: Partial<ArtistCard> & Pick<ArtistCard, "artist_id" | "handle" | "display_name">): ArtistCard {
  return {
    avatar_url: null,
    styles: [],
    min_price_cents: null,
    city: null,
    state: null,
    lat: null,
    lng: null,
    distance_km: null,
    classification: "independent",
    travel_fly_out: false,
    travel_house_calls: false,
    travel_at_home: false,
    books_open: true,
    has_active_flash: false,
    ...c,
  } as ArtistCard;
}

const SEED: ArtistCard[] = [
  card({ artist_id: "1", handle: "demo-folio-nova", display_name: "Nova Reyes", city: "Baltimore", state: "MD", lat: 39.3299, lng: -76.6205, styles: ["fine-line", "floral-botanical", "minimalist", "ornamental"], min_price_cents: 15000, classification: "private_suite", has_active_flash: true }),
  card({ artist_id: "2", handle: "sofia-marchetti", display_name: "Sofia Marchetti", city: "Baltimore", state: "MD", lat: 39.279, lng: -76.611, styles: ["neo-traditional", "japanese-irezumi"], min_price_cents: 22000, has_active_flash: true }),
  card({ artist_id: "3", handle: "desmond-wright", display_name: "Desmond Wright", city: "Baltimore", state: "MD", lat: 39.282, lng: -76.593, styles: ["realism", "black-and-grey", "portrait"], min_price_cents: 30000, classification: "shop_owner" }),
  card({ artist_id: "4", handle: "demo-booking-jayden", display_name: "Jayden Cole", city: "Baltimore", state: "MD", lat: 39.2841, lng: -76.6207, styles: [], min_price_cents: 60000 }),
  card({ artist_id: "5", handle: "marcus-vane", display_name: "Marcus Vane", city: "Philadelphia", state: "PA", lat: 39.966, lng: -75.1345, styles: ["american-traditional", "blackwork"], min_price_cents: 18000, classification: "shop_resident", has_active_flash: true }),
  card({ artist_id: "6", handle: "priya-anand", display_name: "Priya Anand", city: "Philadelphia", state: "PA", lat: 39.949, lng: -75.171, styles: ["fine-line", "micro-realism"], min_price_cents: 25000, classification: "private_suite", books_open: false }),
];

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

/** Local stand-in for the search_artists RPC (offline harness only). */
function applyFilters(cards: ArtistCard[], f: DiscoverFilterState): ArtistCard[] {
  const minCents =
    f.priceMinUsd != null && f.priceMinUsd > PRICE_SLIDER_MIN_USD ? usdToCents(f.priceMinUsd) : null;
  const maxCents =
    f.priceMaxUsd != null && f.priceMaxUsd < PRICE_SLIDER_MAX_USD ? usdToCents(f.priceMaxUsd) : null;
  const center = f.lat != null && f.lng != null ? { lat: f.lat, lng: f.lng } : null;
  const q = f.query.trim().toLowerCase();

  let out = cards.map((c) => {
    const distance_km =
      center && c.lat != null && c.lng != null
        ? Math.round(haversineKm(center, { lat: c.lat, lng: c.lng }) * 100) / 100
        : null;
    return { ...c, distance_km };
  });

  out = out.filter((c) => {
    if (f.styles.length && !c.styles.some((s) => f.styles.includes(s))) return false;
    if (minCents != null || maxCents != null) {
      if (c.min_price_cents == null) return false;
      if (minCents != null && c.min_price_cents < minCents) return false;
      if (maxCents != null && c.min_price_cents > maxCents) return false;
    }
    if (f.booksOpen && !c.books_open) return false;
    if (f.state && c.state !== f.state) return false;
    if (center && f.radiusKm && (c.distance_km == null || c.distance_km > f.radiusKm)) return false;
    if (q) {
      const blob = `${c.display_name} ${c.handle} ${c.city ?? ""} ${c.styles.join(" ")}`.toLowerCase();
      if (!blob.includes(q)) return false;
    }
    return true;
  });

  out.sort((a, b) => {
    if (center) return (a.distance_km ?? 1e9) - (b.distance_km ?? 1e9);
    if (a.has_active_flash !== b.has_active_flash) return a.has_active_flash ? -1 : 1;
    if (a.books_open !== b.books_open) return a.books_open ? -1 : 1;
    return a.display_name.localeCompare(b.display_name);
  });
  return out;
}

export default function DevDiscoverPage() {
  const [filter, setFilter] = useState<DiscoverFilterState>(EMPTY_FILTER_STATE);
  const cards = useMemo(() => applyFilters(SEED, filter), [filter]);
  const center = filter.lat != null && filter.lng != null ? { lat: filter.lat, lng: filter.lng } : null;
  const [activeId, setActiveId] = useState<string | null>(null);

  return (
    <div className="mx-auto flex h-dvh w-full max-w-6xl flex-col gap-4 px-5 py-6">
      <header className="flex items-center justify-between">
        <div>
          <span className="w-fit rounded-full border border-border-subtle bg-surface-overlay px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide text-content-muted">
            Dev harness · offline
          </span>
          <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight">Discover</h1>
        </div>
        <span className="font-mono text-xs text-content-muted">{cards.length} of {SEED.length}</span>
      </header>

      <FilterBar
        filter={filter}
        styles={STYLES}
        resultCount={cards.length}
        onChange={setFilter}
        onReset={() => setFilter(EMPTY_FILTER_STATE)}
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <section className="flex min-h-0 flex-col gap-3 overflow-y-auto pr-1">
          {cards.length === 0 ? (
            <p className="py-16 text-center text-sm text-content-secondary">
              No artists match these filters.
            </p>
          ) : (
            cards.map((c) => (
              <ArtistPlacard key={c.artist_id} card={c} active={activeId === c.artist_id} onHover={setActiveId} />
            ))
          )}
        </section>
        <section className="min-h-[320px] overflow-hidden rounded-sm border border-border-subtle">
          <DiscoverMap
            cards={cards}
            center={center}
            activeId={activeId}
            onHoverPin={setActiveId}
            className="h-full w-full"
          />
        </section>
      </div>

      <p className="font-mono text-[10px] uppercase tracking-wider text-content-muted">
        Prices: {SEED.map((c) => `${c.handle.split("-")[0]} ${formatMinPrice(c.min_price_cents) ?? "quote"}`).join(" · ")}
      </p>
    </div>
  );
}
