/** Hook: the current user's artist profile, if they have one (dual-role model). */
import { useQuery } from "@tanstack/react-query";

import { getCurrentArtistProfile } from "../auth/role";
import { useInkdClient } from "./context";
import { queryKeys } from "./queryKeys";

export function useCurrentArtistProfile() {
  const client = useInkdClient();
  return useQuery({
    queryKey: queryKeys.currentArtistProfile(),
    queryFn: () => getCurrentArtistProfile(client),
  });
}
