/** Hooks: current profile + own-profile mutation. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getCurrentProfile } from "../auth/role";
import { updateProfile } from "../api/profiles";
import type { Profile } from "../types/rows";
import { useInkdClient } from "./context";
import { queryKeys } from "./queryKeys";

export function useCurrentProfile() {
  const client = useInkdClient();
  return useQuery({
    queryKey: queryKeys.currentProfile(),
    queryFn: () => getCurrentProfile(client),
  });
}

export function useUpdateProfile(profileId: string) {
  const client = useInkdClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Parameters<typeof updateProfile>[2]) =>
      updateProfile(client, profileId, patch),
    onSuccess: (profile: Profile) => {
      qc.setQueryData(queryKeys.currentProfile(), profile);
      qc.setQueryData(queryKeys.profile(profile.id), profile);
    },
  });
}
