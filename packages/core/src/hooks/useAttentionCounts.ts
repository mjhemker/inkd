/**
 * Aggregated "needs you" counts for the nav attention badges.
 *
 * One small shared hook the app shell (web sidebar + tab bar, mobile tabs +
 * studio hub) reads so pending work surfaces on the nav itself, not just the
 * bell:
 *   - bookings  — open booking requests awaiting review (pending / reviewing)
 *   - messages  — threads with unread messages
 *   - aiStaff   — agent actions awaiting the artist's approval
 *   - studio    — sum of the studio-scoped items (bookings + aiStaff), for the
 *                 single mobile "Studio" tab that stands in for the group.
 *
 * Reuses the existing realtime-backed pending-approvals count and adds two
 * light, interval-refreshed queries (separate cache keys so they never fight
 * the realtime-mutated list caches) for booking requests and unread threads.
 */
import { useQuery } from "@tanstack/react-query";

import { listArtistBookingRequests } from "../api/booking";
import { listMyThreadSummaries } from "../api/threadDirectory";
import { isRequestOpen } from "../booking/derive";
import { useInkdClient } from "./context";
import { queryKeys } from "./queryKeys";
import { useCurrentProfile } from "./useProfile";
import { useCurrentArtistProfile } from "./useArtistContent";
import { usePendingAgentActionsCount } from "./useAgentStaff";

/** How often the light badge queries re-check for new work. */
const REFETCH_MS = 30_000;

export interface AttentionCounts {
  bookings: number;
  messages: number;
  aiStaff: number;
  /** bookings + aiStaff — the mobile Studio tab aggregates its group. */
  studio: number;
}

export function useAttentionCounts(): AttentionCounts {
  const client = useInkdClient();
  const { data: profile } = useCurrentProfile();
  const { data: artist } = useCurrentArtistProfile();
  const profileId = profile?.id;
  const artistId = artist?.id;

  // Open booking requests needing review. Reuses the request list under a
  // dedicated "attention" key so it can carry its own refetch interval.
  const bookingsQ = useQuery({
    queryKey: [
      ...queryKeys.artistBookingRequests(artistId ?? ""),
      "attention",
    ] as const,
    queryFn: async () => {
      const rows = await listArtistBookingRequests(client, artistId as string);
      return rows.filter((r) => isRequestOpen(r.status)).length;
    },
    enabled: Boolean(artistId),
    refetchInterval: REFETCH_MS,
  });

  // Threads carrying unread messages (client + artist threads merged). A
  // separate cache key from the realtime thread-summary list so we count from
  // a plain snapshot and never double-apply realtime unread bumps.
  const messagesQ = useQuery({
    queryKey: [
      ...queryKeys.threadSummaries(profileId ?? "", artistId ?? null),
      "unreadThreads",
    ] as const,
    queryFn: async () => {
      const summaries = await listMyThreadSummaries(client, {
        profileId: profileId as string,
        artistProfileId: artistId ?? null,
      });
      return summaries.filter((t) => t.unreadCount > 0).length;
    },
    enabled: Boolean(profileId),
    refetchInterval: REFETCH_MS,
  });

  // Agent actions awaiting approval — already live over the shared channel.
  const pendingQ = usePendingAgentActionsCount(artistId);

  const bookings = bookingsQ.data ?? 0;
  const messages = messagesQ.data ?? 0;
  const aiStaff = artistId ? pendingQ.data ?? 0 : 0;

  return { bookings, messages, aiStaff, studio: bookings + aiStaff };
}
