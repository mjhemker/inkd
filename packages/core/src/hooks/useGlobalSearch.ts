/**
 * Hook: global search for the top-bar overlay (web ⌘K) and the mobile search
 * screen. Debounces the query, runs `globalSearch` (artists + shops RPCs in
 * parallel, styles + cities matched against the cached taxonomy), and keeps the
 * previous results visible while the next query resolves. Shared by web + mobile
 * so both overlays behave identically.
 */
import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import {
  globalSearchEntities,
  matchStyles,
  matchCities,
  EMPTY_SEARCH_RESULTS,
  searchResultCount,
  type GlobalSearchResults,
} from "../api/search";
import { listStyles } from "../api/artistProfiles";
import { useInkdClient } from "./context";
import { contentQueryKeys } from "./queryKeysExtras";

const DEBOUNCE_MS = 220;
const MIN_QUERY_LEN = 2;

/** Debounce any value by `delay` ms. */
export function useDebouncedValue<T>(value: T, delay = DEBOUNCE_MS): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export interface UseGlobalSearchResult {
  /** The debounced, trimmed query the results correspond to. */
  query: string;
  results: GlobalSearchResults;
  count: number;
  isFetching: boolean;
  /** True while the FIRST results for a fresh query are loading. */
  isLoading: boolean;
  /** True when a valid (>=2 char) query returned zero hits. */
  isEmpty: boolean;
}

/**
 * Run a debounced global search over `rawQuery`. Queries shorter than 2 chars
 * short-circuit to empty (the overlay shows recent searches instead), so we
 * never fire an RPC on a single keystroke.
 */
export function useGlobalSearch(rawQuery: string): UseGlobalSearchResult {
  const client = useInkdClient();
  const debounced = useDebouncedValue(rawQuery.trim(), DEBOUNCE_MS);
  const active = debounced.length >= MIN_QUERY_LEN;

  // The taxonomy is small + cached; it powers the style/city matchers.
  const { data: styles = [] } = useQuery({
    queryKey: contentQueryKeys.styles(),
    queryFn: () => listStyles(client),
    staleTime: 5 * 60_000,
  });

  // Only the DB-backed entities (artists + shops) are fetched; styles + cities
  // are matched synchronously below so they never depend on the taxonomy's load
  // order (which previously dropped style hits when the query resolved first).
  const query = useQuery({
    queryKey: ["globalSearch", debounced],
    queryFn: () => globalSearchEntities(client, debounced),
    enabled: active,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const results = useMemo<GlobalSearchResults>(() => {
    if (!active) return EMPTY_SEARCH_RESULTS;
    const entities = query.data ?? { artists: [], shops: [] };
    return {
      artists: entities.artists,
      shops: entities.shops,
      styles: matchStyles(debounced, styles),
      cities: matchCities(debounced),
    };
  }, [active, query.data, debounced, styles]);
  const count = searchResultCount(results);

  return {
    query: debounced,
    results,
    count,
    isFetching: query.isFetching,
    isLoading: active && query.isLoading,
    isEmpty: active && !query.isLoading && count === 0,
  };
}
