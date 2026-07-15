/** Hooks: studio_locations CRUD for the current artist. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  listStudioLocations,
  createStudioLocation,
  updateStudioLocation,
  deleteStudioLocation,
} from "../api/studioLocations";
import { useInkdClient } from "./context";

const locationsKey = (artistId: string) =>
  ["studioLocations", artistId] as const;

export function useStudioLocations(artistId: string) {
  const client = useInkdClient();
  return useQuery({
    queryKey: locationsKey(artistId),
    queryFn: () => listStudioLocations(client, artistId),
    enabled: Boolean(artistId),
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
