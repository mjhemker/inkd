/**
 * The discovery filter bar — the heart of SPEC §4 ("filters that actually
 * work"). Every control maps 1:1 to a `search_artists` argument and to a URL
 * param (via DiscoverView), so any filter combination is shareable.
 *
 * City quick-picks (Baltimore / Philadelphia) set the search center + state;
 * style chips, price band, books-open, distance radius and free text stack on
 * top. Reads like flipping through a city's catalog.
 */
import { useState } from "react";
import { Icon, Input, Toggle, cx } from "@inkd/ui/web";
import {
  DISCOVER_CITIES,
  PRICE_BANDS,
  RADIUS_OPTIONS_KM,
  type DiscoverFilterState,
} from "@inkd/core/api";
import type { Style } from "@inkd/core/types";

function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cx(
        "shrink-0 rounded-sm border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors",
        selected
          ? "border-brand bg-brand text-brand-on"
          : "border-border-subtle bg-surface-raised text-content-secondary hover:border-border-strong hover:text-content-primary",
      )}
    >
      {children}
    </button>
  );
}

export interface FilterBarProps {
  filter: DiscoverFilterState;
  styles: Style[];
  resultCount: number;
  onChange: (next: DiscoverFilterState) => void;
  onReset: () => void;
}

export function FilterBar({ filter, styles, resultCount, onChange, onReset }: FilterBarProps) {
  const [stylesOpen, setStylesOpen] = useState(false);
  const patch = (p: Partial<DiscoverFilterState>) => onChange({ ...filter, ...p });

  const hasCenter = filter.lat != null && filter.lng != null;
  const activeStyles = new Set(filter.styles);

  const toggleStyle = (slug: string) => {
    const next = new Set(activeStyles);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    patch({ styles: [...next] });
  };

  const pickCity = (slug: string) => {
    const city = DISCOVER_CITIES.find((c) => c.slug === slug);
    if (!city) return;
    if (filter.city === slug) {
      patch({ city: undefined, lat: undefined, lng: undefined, state: undefined, radiusKm: undefined });
    } else {
      patch({ city: city.slug, lat: city.lat, lng: city.lng, state: city.state, radiusKm: filter.radiusKm ?? 25 });
    }
  };

  const filtersActive =
    filter.styles.length > 0 ||
    filter.priceBand != null ||
    filter.booksOpen ||
    filter.city != null ||
    filter.state != null ||
    filter.query.trim().length > 0;

  return (
    <div className="flex flex-col gap-3 border-b border-border-subtle bg-surface-base pb-4">
      {/* Search + city quick-picks */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex-1">
          <Input
            aria-label="Search artists, styles or cities"
            placeholder="Search name, style or city…"
            value={filter.query}
            onChange={(e) => patch({ query: e.target.value })}
            leadingIcon={<Icon name="search" size={16} />}
          />
        </div>
        <div className="flex items-center gap-2">
          {DISCOVER_CITIES.map((c) => (
            <Chip key={c.slug} selected={filter.city === c.slug} onClick={() => pickCity(c.slug)}>
              <span className="inline-flex items-center gap-1">
                <Icon name="map-pin" size={12} /> {c.label}
              </span>
            </Chip>
          ))}
        </div>
      </div>

      {/* Price band · books open · radius */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-widest text-content-muted">Price</span>
        {PRICE_BANDS.map((b) => (
          <Chip
            key={b.slug}
            selected={filter.priceBand === b.slug}
            onClick={() => patch({ priceBand: filter.priceBand === b.slug ? undefined : b.slug })}
          >
            {b.label}
          </Chip>
        ))}

        <span className="ml-2 inline-flex items-center gap-2">
          <Toggle
            checked={filter.booksOpen}
            onCheckedChange={(v) => patch({ booksOpen: v })}
            label="Open books only"
          />
        </span>

        {hasCenter && (
          <span className="ml-auto inline-flex items-center gap-1">
            <span className="font-mono text-[10px] uppercase tracking-widest text-content-muted">Within</span>
            {RADIUS_OPTIONS_KM.map((km) => (
              <Chip key={km} selected={filter.radiusKm === km} onClick={() => patch({ radiusKm: km })}>
                {km} km
              </Chip>
            ))}
          </span>
        )}
      </div>

      {/* Styles */}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setStylesOpen((v) => !v)}
          className="flex w-fit items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-content-muted hover:text-content-secondary"
        >
          Styles{filter.styles.length > 0 ? ` · ${filter.styles.length}` : ""}
          <Icon name={stylesOpen ? "chevron-down" : "chevron-right"} size={12} />
        </button>
        {stylesOpen && (
          <div className="flex flex-wrap gap-1.5">
            {styles.map((s) => (
              <Chip key={s.slug} selected={activeStyles.has(s.slug)} onClick={() => toggleStyle(s.slug)}>
                {s.name}
              </Chip>
            ))}
          </div>
        )}
      </div>

      {/* Result count + reset */}
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs uppercase tracking-wider text-content-secondary">
          {resultCount} {resultCount === 1 ? "artist" : "artists"}
        </span>
        {filtersActive && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1 font-mono text-xs uppercase tracking-wider text-content-muted hover:text-content-primary"
          >
            <Icon name="x" size={12} /> Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
