/** Hooks: the current user's artist profile + onboarding progression. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getCurrentArtistProfile,
  becomeArtist,
  setOnboardingStep,
} from "../auth/role";
import { updateArtistProfile, listStyles } from "../api/artistProfiles";
import type { ArtistProfile } from "../types/rows";
import { useInkdClient } from "./context";

const currentArtistKey = ["currentArtistProfile"] as const;
const stylesKey = ["styles"] as const;

/** The signed-in user's artist profile (null if they haven't started onboarding). */
export function useCurrentArtistProfile() {
  const client = useInkdClient();
  return useQuery({
    queryKey: currentArtistKey,
    queryFn: () => getCurrentArtistProfile(client),
  });
}

/** Idempotently promote the current user to an artist (creates artist_profiles). */
export function useEnsureArtist() {
  const client = useInkdClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input?: Parameters<typeof becomeArtist>[1]) =>
      becomeArtist(client, input),
    onSuccess: (artist: ArtistProfile) =>
      qc.setQueryData(currentArtistKey, artist),
  });
}

export function useUpdateArtistProfile(artistId: string) {
  const client = useInkdClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Parameters<typeof updateArtistProfile>[2]) =>
      updateArtistProfile(client, artistId, patch),
    onSuccess: (artist: ArtistProfile) =>
      qc.setQueryData(currentArtistKey, artist),
  });
}

/** Persist onboarding progress so the artist resumes where they left off. */
export function useSetOnboardingStep(artistId: string) {
  const client = useInkdClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { step: number; completed?: boolean }) =>
      setOnboardingStep(client, artistId, args.step, {
        completed: args.completed,
      }),
    onSuccess: (artist: ArtistProfile) =>
      qc.setQueryData(currentArtistKey, artist),
  });
}

/** The canonical tattoo-style taxonomy (public read). */
export function useStyles() {
  const client = useInkdClient();
  return useQuery({
    queryKey: stylesKey,
    queryFn: () => listStyles(client),
    staleTime: 5 * 60_000,
  });
}
