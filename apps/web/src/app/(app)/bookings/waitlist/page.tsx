"use client";

/**
 * Waitlist surface. Artists see their cancellation waitlist + controls; clients
 * see their offers + standing entries. Reads the current session role.
 */
import { useQuery } from "@tanstack/react-query";
import { useCurrentProfile, useInkdClient, getCurrentArtistProfile } from "@inkd/core";
import { Skeleton } from "@inkd/ui/web";
import { ClientWaitlist } from "@/components/waitlist/client-waitlist";
import { ArtistWaitlist } from "@/components/waitlist/artist-waitlist";

export default function WaitlistPage() {
  const client = useInkdClient();
  const profileQ = useCurrentProfile();
  const artistQ = useQuery({
    queryKey: ["currentArtistProfile"],
    queryFn: () => getCurrentArtistProfile(client),
  });

  if (profileQ.isLoading || artistQ.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (artistQ.data) {
    return (
      <ArtistWaitlist
        artistId={artistQ.data.id}
        waitlistEnabled={artistQ.data.waitlist_enabled ?? true}
      />
    );
  }

  return <ClientWaitlist clientId={profileQ.data?.id ?? ""} />;
}
