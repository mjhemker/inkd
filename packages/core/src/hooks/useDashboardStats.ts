/** Hook: the artist dashboard's four hero stats, wired to real data (see
 * `../api/dashboardStats`). */
import { useQuery } from "@tanstack/react-query";

import { getDashboardStats, type DashboardStats } from "../api/dashboardStats";
import { useInkdClient } from "./context";
import { queryKeys } from "./queryKeys";

export function useDashboardStats(artistId: string | undefined) {
  const client = useInkdClient();
  return useQuery<DashboardStats>({
    queryKey: queryKeys.dashboardStats(artistId ?? ""),
    queryFn: () => getDashboardStats(client, artistId as string),
    enabled: Boolean(artistId),
  });
}
