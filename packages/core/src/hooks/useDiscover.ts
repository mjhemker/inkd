/**
 * Hook: local artist discovery. Wraps the `searchArtists` RPC in a TanStack
 * query keyed on the (normalized) search params, so the web map/list and the
 * mobile list share one cache and one loading contract.
 *
 * The canonical style taxonomy for the filter chips comes from `useStyles`
 * (in ./useArtistContent) — no need to duplicate it here.
 */
import { useQuery, keepPreviousData } from "@tanstack/react-query";

import {
  searchArtists,
  discoverParamsSchema,
  type ArtistCard,
  type DiscoverParams,
} from "../api/discover";
import { useInkdClient } from "./context";

export type { ArtistCard, DiscoverParams };

/** Stable cache key: the validated params object (undefined filters dropped). */
export function discoverQueryKey(params: DiscoverParams) {
  const parsed = discoverParamsSchema.safeParse(params);
  return ["discover", parsed.success ? parsed.data : {}] as const;
}

export interface UseDiscoverOptions {
  /** Set false to hold the query (e.g. before a location is known). */
  enabled?: boolean;
}

export function useDiscover(
  params: DiscoverParams,
  options: UseDiscoverOptions = {},
) {
  const client = useInkdClient();
  return useQuery({
    queryKey: discoverQueryKey(params),
    queryFn: () => searchArtists(client, params),
    enabled: options.enabled ?? true,
    // Keep the last results visible while a new filter combination loads —
    // the map/list shouldn't blank out on every keystroke or chip toggle.
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}
