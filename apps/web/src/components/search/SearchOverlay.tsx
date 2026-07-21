"use client";

/**
 * Global search overlay — a header-anchored, two-stage expander (⌘K / Ctrl+K,
 * or the top-bar search button). On open it plays as: (1) the compact search
 * bar GROWS ~3x wider leftward from its right-anchored position (a ~200ms width
 * transition), THEN (2) the results / empty-state panel drops down beneath the
 * now-wide bar. Esc or an outside click reverses it — panel up, bar back to
 * compact. Searches across artists, shops, styles and cities (see `globalSearch`
 * in @inkd/core for the deliberate client-account exclusion).
 *
 * Grouped placard results, full keyboard navigation (↑/↓ to move, ↵ to open,
 * esc to close), debounced queries, trgm typo-tolerance from the RPCs, and
 * local-only recent searches. Clients are NOT searchable by design — only
 * public entities (artists / shops) and the taxonomy/geo that route into
 * discovery.
 *
 * NOTE: because it positions with `absolute` (bar overlays the trigger, panel
 * drops beneath), callers must render it inside a `position: relative` container
 * (the app TopBar and the /dev/search-preview harness both do).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, Icon, Spinner, cx, type IconName } from "@inkd/ui/web";
import {
  useGlobalSearch,
  flattenSearchResults,
  searchResultHref,
  addRecentSearch,
  removeRecentSearch,
  parseRecentSearches,
  RECENT_SEARCHES_KEY,
  type SearchResult,
  type RecentSearch,
} from "@inkd/core";

export interface SearchOverlayProps {
  open: boolean;
  onClose: () => void;
  /** Preset the query on open (used by the offline preview harness/tests). */
  initialQuery?: string;
}

export function SearchOverlay({ open, onClose, initialQuery = "" }: SearchOverlayProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [activeIndex, setActiveIndex] = useState(0);
  const [recents, setRecents] = useState<RecentSearch[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Two-stage open animation: `render` keeps the DOM mounted through the exit
  // transition; `expanded` drives the bar's width (compact ↔ ~3x); `panelOpen`
  // drives the results panel dropping in *after* the bar has finished widening.
  const [render, setRender] = useState(open);
  const [expanded, setExpanded] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  const { results, count, isLoading, isFetching, isEmpty, query: debounced } =
    useGlobalSearch(query);
  const flat = useMemo(() => flattenSearchResults(results), [results]);
  const showingResults = debounced.length >= 2 && count > 0;

  const BAR_MS = 200;

  // Drive the open/close choreography off `open`.
  useEffect(() => {
    if (open) {
      setRender(true);
      // Reset the query + recents on each open.
      try {
        setRecents(parseRecentSearches(window.localStorage.getItem(RECENT_SEARCHES_KEY)));
      } catch {
        setRecents([]);
      }
      setQuery(initialQuery);
      setActiveIndex(0);
      // Next frame: widen the bar. After it finishes: drop the panel + focus.
      const raf = requestAnimationFrame(() => setExpanded(true));
      const t = setTimeout(() => {
        setPanelOpen(true);
        inputRef.current?.focus();
      }, BAR_MS + 10);
      return () => {
        cancelAnimationFrame(raf);
        clearTimeout(t);
      };
    }
    // Closing: panel up first, then bar collapses, then unmount.
    setPanelOpen(false);
    setExpanded(false);
    const t = setTimeout(() => setRender(false), BAR_MS + 10);
    return () => clearTimeout(t);
  }, [open, initialQuery]);

  // Lock the page scroll while mounted.
  useEffect(() => {
    if (!render) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [render]);

  // Keep the active index in range as results change.
  useEffect(() => {
    setActiveIndex((i) => (flat.length === 0 ? 0 : Math.min(i, flat.length - 1)));
  }, [flat.length]);

  const persistRecents = useCallback((next: RecentSearch[]) => {
    setRecents(next);
    try {
      window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
    } catch {
      /* storage may be unavailable (private mode) — recents are best-effort */
    }
  }, []);

  const go = useCallback(
    (result: SearchResult) => {
      // Record the typed query (what the user searched), not the result label.
      if (debounced.trim().length >= 2) {
        persistRecents(addRecentSearch(recents, debounced));
      }
      onClose();
      router.push(searchResultHref(result, "web"));
    },
    [debounced, recents, persistRecents, onClose, router],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (!showingResults) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % flat.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + flat.length) % flat.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = flat[activeIndex];
      if (target) go(target);
    }
  };

  // Scroll the active row into view on keyboard nav.
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-idx="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (!render) return null;

  // A running index so each row knows its position in the flattened nav order.
  let idx = -1;
  const nextIdx = () => (idx += 1);

  return (
    <>
      {/* Transparent click-catcher: closes on any outside click without dimming
          the page — this reads as a header control, not a full-screen modal. */}
      <div
        className="fixed inset-0 z-40"
        aria-hidden
        onMouseDown={onClose}
      />
      {/* Anchored to the trigger's `relative` wrapper: the bar overlays the
          trigger (right-0 top-0) and grows leftward; the panel drops beneath. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search INKD"
        className="absolute right-0 top-0 z-50"
        onKeyDown={onKeyDown}
      >
        {/* Stage 1 — the search bar, growing ~3x wider leftward on open. */}
        <div
          className={cx(
            "flex h-10 items-center gap-2.5 rounded-lg border bg-surface-raised px-3 shadow-lg transition-[width,border-color] duration-200 ease-[cubic-bezier(0.2,0,0,1)]",
            expanded
              ? "w-[min(92vw,34rem)] border-border-strong"
              : "w-[190px] border-border-subtle",
          )}
        >
          <Icon name="search" size={17} className="shrink-0 text-content-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            placeholder="Search artists, shops, styles, cities…"
            className="h-10 flex-1 bg-transparent text-sm text-content-primary outline-none placeholder:text-content-muted"
            aria-label="Search query"
            autoComplete="off"
            spellCheck={false}
          />
          {isFetching && <Spinner size={15} />}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-content-muted outline-none transition-colors hover:bg-surface-overlay hover:text-content-primary focus-visible:ring-2 focus-visible:ring-brand"
          >
            <Icon name="x" size={15} />
          </button>
        </div>

        {/* Stage 2 — the results / empty-state panel, dropping in beneath the
            bar once it has finished widening. */}
        <div
          className={cx(
            "absolute right-0 top-[calc(100%+8px)] flex max-h-[min(72vh,34rem)] w-[min(92vw,34rem)] flex-col overflow-hidden rounded-xl border border-border-subtle bg-surface-raised shadow-2xl transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)]",
            panelOpen
              ? "pointer-events-auto translate-y-0 opacity-100"
              : "pointer-events-none -translate-y-1.5 opacity-0",
          )}
        >
        {/* Body */}
        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto p-2">
          {debounced.length < 2 ? (
            <RecentsPanel
              recents={recents}
              onPick={(q) => {
                setQuery(q);
                setActiveIndex(0);
                inputRef.current?.focus();
              }}
              onRemove={(q) => persistRecents(removeRecentSearch(recents, q))}
              onClear={() => persistRecents([])}
            />
          ) : isLoading ? (
            <div className="flex items-center justify-center gap-2 py-14 text-content-muted">
              <Spinner size={18} /> <span className="text-sm">Searching…</span>
            </div>
          ) : isEmpty ? (
            <EmptyPanel query={debounced} />
          ) : (
            <div className="flex flex-col gap-1">
              {results.artists.length > 0 && (
                <Group icon="user" label="Artists">
                  {results.artists.map((r) => {
                    const i = nextIdx();
                    return (
                      <ResultRow
                        key={r.id}
                        idx={i}
                        active={i === activeIndex}
                        onHover={() => setActiveIndex(i)}
                        onClick={() => go(r)}
                        avatar={<Avatar src={r.avatarUrl ?? undefined} name={r.displayName} size="sm" shape="square" />}
                        title={r.displayName}
                        handle={r.handle}
                        stamps={r.styles.slice(0, 3)}
                        city={cityLabel(r.city, r.state)}
                      />
                    );
                  })}
                </Group>
              )}

              {results.shops.length > 0 && (
                <Group icon="home" label="Shops">
                  {results.shops.map((r) => {
                    const i = nextIdx();
                    return (
                      <ResultRow
                        key={r.id}
                        idx={i}
                        active={i === activeIndex}
                        onHover={() => setActiveIndex(i)}
                        onClick={() => go(r)}
                        avatar={<Avatar src={r.avatarUrl ?? undefined} name={r.name} size="sm" shape="square" />}
                        title={r.name}
                        handle={r.handle}
                        meta={`${r.memberCount} ${r.memberCount === 1 ? "artist" : "artists"}`}
                        city={cityLabel(r.city, r.state)}
                      />
                    );
                  })}
                </Group>
              )}

              {results.styles.length > 0 && (
                <Group icon="sparkles" label="Styles">
                  {results.styles.map((r) => {
                    const i = nextIdx();
                    return (
                      <ResultRow
                        key={r.slug}
                        idx={i}
                        active={i === activeIndex}
                        onHover={() => setActiveIndex(i)}
                        onClick={() => go(r)}
                        avatar={<GlyphTile icon="sparkles" />}
                        title={r.name}
                        meta="Browse this style in discover"
                      />
                    );
                  })}
                </Group>
              )}

              {results.cities.length > 0 && (
                <Group icon="map-pin" label="Cities">
                  {results.cities.map((r) => {
                    const i = nextIdx();
                    return (
                      <ResultRow
                        key={r.slug}
                        idx={i}
                        active={i === activeIndex}
                        onHover={() => setActiveIndex(i)}
                        onClick={() => go(r)}
                        avatar={<GlyphTile icon="map-pin" />}
                        title={r.label}
                        meta={`Artists near ${r.label}, ${r.state}`}
                      />
                    );
                  })}
                </Group>
              )}
            </div>
          )}
        </div>

        {/* Footer: keycap hints on their own row, then the privacy note as a
            separate muted line below a thin divider (no longer crammed beside
            the keycaps). */}
        <div className="flex flex-col gap-2 border-t border-border-subtle bg-surface-base/60 px-4 py-2.5">
          <span className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-wider text-content-muted">
            <Hint keys="↑ ↓" label="Navigate" />
            <Hint keys="↵" label="Open" />
            <Hint keys="esc" label="Close" />
          </span>
          <span className="flex items-center gap-1.5 border-t border-border-subtle/60 pt-2 text-[11px] text-content-muted">
            <Icon name="shield" size={11} className="shrink-0" />
            Clients aren&apos;t searchable — INKD keeps them private
          </span>
        </div>
        </div>
      </div>
    </>
  );
}

function cityLabel(city: string | null, state: string | null): string | undefined {
  const s = [city, state].filter(Boolean).join(", ");
  return s || undefined;
}

function Group({
  icon,
  label,
  children,
}: {
  icon: IconName;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 px-3 pb-1 pt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-content-muted">
        <Icon name={icon} size={12} />
        {label}
      </div>
      {children}
    </div>
  );
}

function GlyphTile({ icon }: { icon: IconName }) {
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-sm border border-border-subtle bg-surface-overlay text-content-accent">
      <Icon name={icon} size={16} />
    </span>
  );
}

function ResultRow({
  idx,
  active,
  onHover,
  onClick,
  avatar,
  title,
  handle,
  stamps,
  city,
  meta,
}: {
  idx: number;
  active: boolean;
  onHover: () => void;
  onClick: () => void;
  avatar: React.ReactNode;
  title: string;
  handle?: string;
  stamps?: string[];
  city?: string;
  meta?: string;
}) {
  return (
    <button
      type="button"
      data-idx={idx}
      onMouseMove={onHover}
      onClick={onClick}
      className={cx(
        "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left outline-none transition-colors",
        active ? "bg-surface-plate-ink" : "hover:bg-surface-overlay",
      )}
    >
      {avatar}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-content-primary">{title}</span>
          {handle && (
            <span className="truncate font-mono text-xs text-content-muted">@{handle}</span>
          )}
        </span>
        <span className="flex items-center gap-2 truncate">
          {stamps && stamps.length > 0 && (
            <span className="flex gap-1">
              {stamps.map((s) => (
                <span
                  key={s}
                  className="rounded-sm border border-border-subtle bg-surface-overlay px-1.5 py-0.5 text-[10px] text-content-secondary"
                >
                  {styleLabel(s)}
                </span>
              ))}
            </span>
          )}
          {meta && <span className="truncate text-xs text-content-muted">{meta}</span>}
          {city && (
            <span className="flex items-center gap-1 truncate text-xs text-content-muted">
              <Icon name="map-pin" size={11} /> {city}
            </span>
          )}
        </span>
      </span>
      <Icon
        name="arrow-right"
        size={14}
        className={cx("shrink-0", active ? "text-content-accent" : "text-content-muted/0")}
      />
    </button>
  );
}

function RecentsPanel({
  recents,
  onPick,
  onRemove,
  onClear,
}: {
  recents: RecentSearch[];
  onPick: (q: string) => void;
  onRemove: (q: string) => void;
  onClear: () => void;
}) {
  if (recents.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
        <Icon name="search" size={26} className="text-content-muted" />
        <p className="text-sm text-content-secondary">
          Search artists, shops, styles and cities.
        </p>
        <p className="max-w-xs text-xs text-content-muted">
          Try a name, a style like &ldquo;fine line&rdquo;, or a city like &ldquo;Baltimore&rdquo;.
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-3 pb-1 pt-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-content-muted">
          Recent
        </span>
        <button
          type="button"
          onClick={onClear}
          className="font-mono text-[10px] uppercase tracking-wider text-content-muted outline-none hover:text-content-primary focus-visible:ring-2 focus-visible:ring-brand"
        >
          Clear
        </button>
      </div>
      {recents.map((r) => (
        <div
          key={r.query}
          className="group flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-surface-overlay"
        >
          <Icon name="clock" size={15} className="shrink-0 text-content-muted" />
          <button
            type="button"
            onClick={() => onPick(r.query)}
            className="flex-1 truncate text-left text-sm text-content-secondary outline-none focus-visible:text-content-primary"
          >
            {r.query}
          </button>
          <button
            type="button"
            aria-label={`Remove ${r.query}`}
            onClick={() => onRemove(r.query)}
            className="grid h-6 w-6 shrink-0 place-items-center rounded text-content-muted opacity-0 outline-none transition-opacity hover:text-content-primary focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-brand group-hover:opacity-100"
          >
            <Icon name="x" size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}

function EmptyPanel({ query }: { query: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
      <Icon name="search" size={26} className="text-content-muted" />
      <p className="text-sm text-content-primary">No results for &ldquo;{query}&rdquo;</p>
      <p className="max-w-xs text-xs text-content-muted">
        Try a different spelling, a broader style, or one of the pilot cities.
      </p>
    </div>
  );
}

function Hint({ keys, label }: { keys: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <kbd className="rounded border border-border-subtle bg-surface-overlay px-1.5 py-0.5 text-[10px] not-italic text-content-secondary">
        {keys}
      </kbd>
      {label}
    </span>
  );
}

function styleLabel(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
