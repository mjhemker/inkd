"use client";

/**
 * Feed filter panel — the "Filters" popover on the feed (SPEC §4). Beyond the
 * style chip row: multi-select styles, location (city quick-picks + near-me),
 * a dual-thumb price range, and a books-open toggle. Commits live (sliders
 * debounced) so the feed updates as you tune, mirroring discover's FilterBar.
 * The panel edits a `DiscoverFilterState` (reused as `FeedFilterState`); the feed
 * applies styles at the post level and location/price/books via the RPC.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon, RangeSlider, Toggle, cx } from "@inkd/ui/web";
import {
  DISCOVER_CITIES,
  DEFAULT_RADIUS_MI,
  milesToKm,
  formatPriceUsd,
  PRICE_SLIDER_MIN_USD,
  PRICE_SLIDER_MAX_USD,
  PRICE_SLIDER_STEP_USD,
  hasActiveFeedFilters,
  hasStyleQuery,
  rankStyles,
  collapsedStyleCount,
  addRecentStyles,
  parseRecentStyles,
  RECENT_STYLES_KEY,
  type FeedFilterState,
} from "@inkd/core";
import type { Style } from "@inkd/core/types";

const COMMIT_DEBOUNCE_MS = 260;

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
        "shrink-0 rounded-sm border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide transition-colors",
        selected
          ? "border-brand bg-brand text-brand-on"
          : "border-border-subtle bg-surface-raised text-content-secondary hover:border-border-strong hover:text-content-primary",
      )}
    >
      {children}
    </button>
  );
}

export function FeedFilterPanel({
  filter,
  styles,
  preferredStyles,
  onChange,
  onReset,
  onClose,
}: {
  filter: FeedFilterState;
  styles: Style[];
  /** Viewer's preferred styles (e.g. an artist's own profile styles) — ranked high. */
  preferredStyles?: string[];
  onChange: (next: FeedFilterState) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const patch = (p: Partial<FeedFilterState>) => onChange({ ...filter, ...p });
  const activeStyles = new Set(filter.styles);

  // Recently-used styles (local-only) drive the collapsed chip ordering.
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => {
    try {
      setRecent(parseRecentStyles(window.localStorage.getItem(RECENT_STYLES_KEY)));
    } catch {
      setRecent([]);
    }
  }, []);
  const recordRecent = (slug: string) => {
    setRecent((prev) => {
      const next = addRecentStyles(prev, [slug]);
      try {
        window.localStorage.setItem(RECENT_STYLES_KEY, JSON.stringify(next));
      } catch {
        /* storage may be unavailable (private mode) — recency is best-effort */
      }
      return next;
    });
  };

  // Show ~6 chips (selected first, then preferred/recent, then popularity),
  // with a "View more" expander for the full list + the "Other" free-text.
  // Start expanded if an "Other" free-text query is already active, so its chip
  // (and input) are reachable without first hunting for "View more".
  const [stylesExpanded, setStylesExpanded] = useState(() => hasStyleQuery(filter));
  const orderedStyles = useMemo(
    () => rankStyles(styles, { selected: filter.styles, preferred: preferredStyles, recent }),
    [styles, filter.styles, preferredStyles, recent],
  );
  const collapsedCount = collapsedStyleCount(filter.styles.length);
  const visibleStyles = stylesExpanded ? orderedStyles : orderedStyles.slice(0, collapsedCount);
  const hiddenCount = Math.max(0, orderedStyles.length - collapsedCount);
  const [geoBusy, setGeoBusy] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const nearMeActive = filter.lat != null && filter.lng != null && !filter.city;

  // Debounced price commit so a drag doesn't fire a query per frame.
  const [priceLocal, setPriceLocal] = useState<[number, number]>([
    filter.priceMinUsd ?? PRICE_SLIDER_MIN_USD,
    filter.priceMaxUsd ?? PRICE_SLIDER_MAX_USD,
  ]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    setPriceLocal([filter.priceMinUsd ?? PRICE_SLIDER_MIN_USD, filter.priceMaxUsd ?? PRICE_SLIDER_MAX_USD]);
  }, [filter.priceMinUsd, filter.priceMaxUsd]);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const onPriceChange = ([lo, hi]: [number, number]) => {
    setPriceLocal([lo, hi]);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(
      () =>
        onChange({
          ...filter,
          priceMinUsd: lo > PRICE_SLIDER_MIN_USD ? lo : undefined,
          priceMaxUsd: hi < PRICE_SLIDER_MAX_USD ? hi : undefined,
        }),
      COMMIT_DEBOUNCE_MS,
    );
  };

  const toggleStyle = (slug: string) => {
    const next = new Set(activeStyles);
    if (next.has(slug)) next.delete(slug);
    else {
      next.add(slug);
      recordRecent(slug);
    }
    patch({ styles: [...next] });
  };

  // "Other" — a free-text style query for anything outside the taxonomy.
  // Debounced the same way price is, so typing doesn't fire a query per key.
  const [otherOpen, setOtherOpen] = useState(hasStyleQuery(filter));
  const [otherLocal, setOtherLocal] = useState(filter.styleQuery ?? "");
  const otherTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    setOtherLocal(filter.styleQuery ?? "");
  }, [filter.styleQuery]);
  useEffect(() => () => { if (otherTimerRef.current) clearTimeout(otherTimerRef.current); }, []);

  const toggleOther = () => {
    if (otherOpen) {
      setOtherOpen(false);
      setOtherLocal("");
      patch({ styleQuery: undefined });
    } else {
      setOtherOpen(true);
    }
  };

  const onOtherChange = (value: string) => {
    setOtherLocal(value);
    if (otherTimerRef.current) clearTimeout(otherTimerRef.current);
    otherTimerRef.current = setTimeout(
      () => patch({ styleQuery: value.trim() || undefined }),
      COMMIT_DEBOUNCE_MS,
    );
  };

  const pickCity = (slug: string) => {
    const city = DISCOVER_CITIES.find((c) => c.slug === slug);
    if (!city) return;
    if (filter.city === slug) {
      patch({ city: undefined, lat: undefined, lng: undefined, state: undefined, radiusKm: undefined });
    } else {
      patch({
        city: city.slug,
        lat: city.lat,
        lng: city.lng,
        state: city.state,
        radiusKm: filter.radiusKm ?? milesToKm(DEFAULT_RADIUS_MI),
      });
    }
  };

  const useMyLocation = () => {
    setGeoError(null);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoError("Location isn't available — pick a city.");
      return;
    }
    if (nearMeActive) {
      patch({ lat: undefined, lng: undefined, radiusKm: undefined });
      return;
    }
    setGeoBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoBusy(false);
        patch({
          city: undefined,
          state: undefined,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          radiusKm: filter.radiusKm ?? milesToKm(DEFAULT_RADIUS_MI),
        });
      },
      () => {
        setGeoBusy(false);
        setGeoError("Couldn't get your location — pick a city.");
      },
      { enableHighAccuracy: false, timeout: 8000 },
    );
  };

  return (
    <div
      role="dialog"
      aria-label="Feed filters"
      className="flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-4 rounded-lg border border-border-subtle bg-surface-raised p-4 shadow-2xl"
    >
      <div className="flex items-center justify-between">
        <span className="font-display text-sm font-bold text-content-primary">Filters</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close filters"
          className="grid h-7 w-7 place-items-center rounded text-content-muted outline-none hover:bg-surface-overlay hover:text-content-primary focus-visible:ring-2 focus-visible:ring-brand"
        >
          <Icon name="x" size={15} />
        </button>
      </div>

      {/* Location */}
      <div className="flex flex-col gap-1.5">
        <span className="font-mono text-[10px] uppercase tracking-widest text-content-muted">Location</span>
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip selected={nearMeActive} onClick={useMyLocation}>
            <span className="inline-flex items-center gap-1">
              <Icon name="compass" size={12} /> {geoBusy ? "Locating…" : "Near me"}
            </span>
          </Chip>
          {DISCOVER_CITIES.map((c) => (
            <Chip key={c.slug} selected={filter.city === c.slug} onClick={() => pickCity(c.slug)}>
              <span className="inline-flex items-center gap-1">
                <Icon name="map-pin" size={12} /> {c.label}
              </span>
            </Chip>
          ))}
        </div>
        {geoError && <span className="text-xs text-content-ember">{geoError}</span>}
      </div>

      {/* Price */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-widest text-content-muted">Price</span>
          <span className="font-mono text-xs tabular-nums text-content-secondary">
            {formatPriceUsd(priceLocal[0])} – {formatPriceUsd(priceLocal[1])}
          </span>
        </div>
        <RangeSlider
          value={priceLocal}
          onValueChange={onPriceChange}
          min={PRICE_SLIDER_MIN_USD}
          max={PRICE_SLIDER_MAX_USD}
          step={PRICE_SLIDER_STEP_USD}
          formatValue={formatPriceUsd}
        />
      </div>

      {/* Books open */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-content-secondary">Open books only</span>
        <Toggle checked={filter.booksOpen} onCheckedChange={(v) => patch({ booksOpen: v })} />
      </div>

      {/* Styles */}
      <div className="flex flex-col gap-1.5">
        <span className="font-mono text-[10px] uppercase tracking-widest text-content-muted">
          Styles{filter.styles.length > 0 ? ` · ${filter.styles.length}` : ""}
        </span>
        <div className={cx("flex flex-wrap gap-1.5", stylesExpanded && "max-h-40 overflow-y-auto")}>
          {visibleStyles.map((s) => (
            <Chip key={s.slug} selected={activeStyles.has(s.slug)} onClick={() => toggleStyle(s.slug)}>
              {s.name}
            </Chip>
          ))}
          {stylesExpanded && (
            <Chip selected={otherOpen} onClick={toggleOther}>
              Other
            </Chip>
          )}
          {(hiddenCount > 0 || stylesExpanded) && (
            <button
              type="button"
              onClick={() => setStylesExpanded((v) => !v)}
              aria-expanded={stylesExpanded}
              className="shrink-0 rounded-sm border border-dashed border-border-strong px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-content-secondary outline-none transition-colors hover:border-brand hover:text-content-primary focus-visible:ring-2 focus-visible:ring-brand"
            >
              {stylesExpanded ? "View less" : `View more · ${hiddenCount}`}
            </button>
          )}
        </div>
        {otherOpen && (
          <input
            type="text"
            value={otherLocal}
            onChange={(e) => onOtherChange(e.target.value)}
            placeholder="e.g. Chicano, dotwork…"
            aria-label="Other style — search by name"
            autoFocus
            className="w-full rounded-sm border border-border-subtle bg-surface-base px-2.5 py-1.5 text-sm text-content-primary outline-none placeholder:text-content-muted focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand"
          />
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-border-subtle pt-3">
        <button
          type="button"
          onClick={onReset}
          disabled={!hasActiveFeedFilters(filter)}
          className="inline-flex items-center gap-1 font-mono text-xs uppercase tracking-wider text-content-muted outline-none transition-colors hover:text-content-primary focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-40"
        >
          <Icon name="x" size={12} /> Clear all
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-sm bg-brand px-4 py-1.5 font-sans text-sm font-semibold text-brand-on outline-none transition-colors hover:bg-brand-hover focus-visible:ring-2 focus-visible:ring-brand"
        >
          Done
        </button>
      </div>
    </div>
  );
}
