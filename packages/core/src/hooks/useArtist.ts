/**
 * Hooks: onboarding-specific artist-profile mutations.
 *
 * The read hook (`useCurrentArtistProfile`), `useUpdateArtistProfile`, and
 * `useStyles` live in `./useArtistContent` (the canonical artist/content module)
 * — this file only holds the onboarding-progression mutations that are unique to
 * the onboarding flow. Cache key `["currentArtistProfile"]` is shared with
 * useArtistContent so these mutations keep that query in sync.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { becomeArtist, setOnboardingStep } from "../auth/role";
import type { ArtistProfile } from "../types/rows";
import { useInkdClient } from "./context";

const currentArtistKey = ["currentArtistProfile"] as const;

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
