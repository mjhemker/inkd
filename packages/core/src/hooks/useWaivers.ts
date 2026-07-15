/**
 * Hooks: waiver template management (artist) + client signing flow.
 *
 * Local query keys (not added to the shared `queryKeys.ts` factory — this
 * module owns its own small key namespace so it doesn't need to touch that
 * shared file).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  listWaiverTemplates,
  listSignedWaivers,
  signWaiver,
} from "../api/waivers";
import {
  listGlobalWaiverTemplates,
  listArtistOwnWaiverTemplates,
  getWaiverTemplate,
  pickGlobalWaiverTemplate,
  updateWaiverTemplate,
  resolveTemplateForBooking,
} from "../api/waiverTemplateManagement";
import { useInkdClient } from "./context";

const waiverKeys = {
  global: () => ["waiverTemplates", "global"] as const,
  artistOwn: (artistId: string) => ["waiverTemplates", "artist", artistId] as const,
  template: (id: string) => ["waiverTemplate", id] as const,
  all: (state?: string) => ["waiverTemplates", "all", state ?? "any"] as const,
  signedForArtist: (artistId: string) => ["signedWaivers", "artist", artistId] as const,
  bookingContext: (bookingId: string) => ["waiverBookingContext", bookingId] as const,
};

/** All templates visible to the current session (own + active global), per RLS. */
export function useWaiverTemplates(state?: "MD" | "PA") {
  const client = useInkdClient();
  return useQuery({
    queryKey: waiverKeys.all(state),
    queryFn: () => listWaiverTemplates(client, { state }),
  });
}

/** The three INKD-authored global templates (MD / PA / generic). */
export function useGlobalWaiverTemplates() {
  const client = useInkdClient();
  return useQuery({
    queryKey: waiverKeys.global(),
    queryFn: () => listGlobalWaiverTemplates(client),
  });
}

/** An artist's own customized templates (management page list). */
export function useArtistWaiverTemplates(artistId: string) {
  const client = useInkdClient();
  return useQuery({
    queryKey: waiverKeys.artistOwn(artistId),
    queryFn: () => listArtistOwnWaiverTemplates(client, artistId),
    enabled: Boolean(artistId),
  });
}

export function useWaiverTemplate(id: string | undefined) {
  const client = useInkdClient();
  return useQuery({
    queryKey: waiverKeys.template(id ?? ""),
    queryFn: () => getWaiverTemplate(client, id as string),
    enabled: Boolean(id),
  });
}

export function usePickGlobalWaiverTemplate(artistId: string) {
  const client = useInkdClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (globalTemplateId: string) =>
      pickGlobalWaiverTemplate(client, artistId, globalTemplateId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: waiverKeys.artistOwn(artistId) });
    },
  });
}

export function useUpdateWaiverTemplate(artistId: string) {
  const client = useInkdClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: {
      id: string;
      patch: Parameters<typeof updateWaiverTemplate>[2];
    }) => updateWaiverTemplate(client, args.id, args.patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: waiverKeys.artistOwn(artistId) });
    },
  });
}

/** Signed waivers for an artist's /settings/waivers list. */
export function useSignedWaiversForArtist(artistId: string) {
  const client = useInkdClient();
  return useQuery({
    queryKey: waiverKeys.signedForArtist(artistId),
    queryFn: () => listSignedWaivers(client, { artistId }),
    enabled: Boolean(artistId),
  });
}

/** Resolved { booking, state, template } for the client signing screen. */
export function useBookingWaiverContext(bookingId: string | undefined) {
  const client = useInkdClient();
  return useQuery({
    queryKey: waiverKeys.bookingContext(bookingId ?? ""),
    queryFn: () => resolveTemplateForBooking(client, bookingId as string),
    enabled: Boolean(bookingId),
  });
}

export function useSignWaiver() {
  const client = useInkdClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof signWaiver>[1]) =>
      signWaiver(client, input),
    onSuccess: (waiver) => {
      void qc.invalidateQueries({
        queryKey: waiverKeys.signedForArtist(waiver.artist_id),
      });
    },
  });
}
