/**
 * Hooks: studio_locations write mutations for the current artist.
 *
 * The read hook (`useStudioLocations`) is the canonical one in
 * `./useArtistContent`; this module owns the create/update/delete mutations
 * (onboarding + settings). They invalidate the shared `["studioLocations",
 * artistId]` key so the read stays in sync.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  createStudioLocation,
  updateStudioLocation,
  deleteStudioLocation,
} from "../api/studioLocations";
import { useInkdClient } from "./context";

const locationsKey = (artistId: string) =>
  ["studioLocations", artistId] as const;

export function useStudioLocationMutations(artistId: string) {
  const client = useInkdClient();
  const qc = useQueryClient();
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: locationsKey(artistId) });

  return {
    create: useMutation({
      mutationFn: (input: Parameters<typeof createStudioLocation>[2]) =>
        createStudioLocation(client, artistId, input),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: (args: {
        id: string;
        patch: Parameters<typeof updateStudioLocation>[2];
      }) => updateStudioLocation(client, args.id, args.patch),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => deleteStudioLocation(client, id),
      onSuccess: invalidate,
    }),
  };
}
