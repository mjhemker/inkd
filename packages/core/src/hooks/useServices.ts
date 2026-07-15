/** Hooks: services CRUD for the current artist. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  listServices,
  createService,
  updateService,
  deleteService,
} from "../api/services";
import { useInkdClient } from "./context";
import { queryKeys } from "./queryKeys";

export function useServices(artistId: string) {
  const client = useInkdClient();
  return useQuery({
    queryKey: queryKeys.services(artistId),
    queryFn: () => listServices(client, artistId),
    enabled: Boolean(artistId),
  });
}

export function useCreateService(artistId: string) {
  const client = useInkdClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof createService>[2]) =>
      createService(client, artistId, input),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.services(artistId) }),
  });
}

export function useUpdateService(artistId: string) {
  const client = useInkdClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: {
      id: string;
      patch: Parameters<typeof updateService>[2];
    }) => updateService(client, args.id, args.patch),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.services(artistId) }),
  });
}

export function useDeleteService(artistId: string) {
  const client = useInkdClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteService(client, id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.services(artistId) }),
  });
}
