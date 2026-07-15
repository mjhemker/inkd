/**
 * Hooks: studio_locations write mutations for the current artist.
 *
 * The read hook (`useStudioLocations`) is the canonical one in
 * `./useArtistContent`; this module owns the create/update/delete mutations
 * (onboarding + settings). They invalidate the shared `["studioLocations",
 * artistId]` key so the read stays in sync.
 *
 * Geocoding: locations are saved with the address the artist typed but usually
 * without coordinates. After a successful create/update we fire the
 * `geocode-location` edge function (Nominatim-backed, server-side cache) in the
 * background — never blocking the save. When it resolves it will have written
 * lat/lng onto the row, so we re-invalidate to pull the fresh coordinates and
 * (best-effort) any cached discovery results.
 */
import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";

import {
  createStudioLocation,
  updateStudioLocation,
  deleteStudioLocation,
} from "../api/studioLocations";
import type { StudioLocation } from "../types/rows";
import type { InkdSupabaseClient } from "../supabase/client";
import { useInkdClient } from "./context";

const locationsKey = (artistId: string) =>
  ["studioLocations", artistId] as const;

/** True when the row has an address to geocode but no coordinates yet. */
function needsGeocoding(loc: StudioLocation): boolean {
  const hasAddress = Boolean(
    (loc.address_line1 && loc.address_line1.trim()) ||
      (loc.city && loc.city.trim()) ||
      (loc.postal_code && loc.postal_code.trim()),
  );
  return hasAddress && (loc.lat == null || loc.lng == null);
}

/**
 * Fire-and-forget geocode. Invokes the edge function; on completion refreshes
 * the locations cache so newly-resolved coordinates appear. Any failure (egress
 * blocked, rate limit, no match) is swallowed — the save already succeeded and
 * the artist can retry by editing again.
 */
function triggerGeocode(
  client: InkdSupabaseClient,
  qc: QueryClient,
  artistId: string,
  loc: StudioLocation,
): void {
  if (!needsGeocoding(loc)) return;
  void client.functions
    .invoke("geocode-location", { body: { location_id: loc.id } })
    .then(() => {
      void qc.invalidateQueries({ queryKey: locationsKey(artistId) });
      void qc.invalidateQueries({ queryKey: ["discover"] });
    })
    .catch(() => {
      /* best-effort: never surface geocode failures to the save flow */
    });
}

export function useStudioLocationMutations(artistId: string) {
  const client = useInkdClient();
  const qc = useQueryClient();
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: locationsKey(artistId) });

  return {
    create: useMutation({
      mutationFn: (input: Parameters<typeof createStudioLocation>[2]) =>
        createStudioLocation(client, artistId, input),
      onSuccess: (loc) => {
        invalidate();
        triggerGeocode(client, qc, artistId, loc);
      },
    }),
    update: useMutation({
      mutationFn: (args: {
        id: string;
        patch: Parameters<typeof updateStudioLocation>[2];
      }) => updateStudioLocation(client, args.id, args.patch),
      onSuccess: (loc) => {
        invalidate();
        triggerGeocode(client, qc, artistId, loc);
      },
    }),
    remove: useMutation({
      mutationFn: (id: string) => deleteStudioLocation(client, id),
      onSuccess: invalidate,
    }),
  };
}
