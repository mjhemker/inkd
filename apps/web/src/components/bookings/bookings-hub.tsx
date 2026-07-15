"use client";

/**
 * Role-aware bookings entry. Artists get the requests inbox + pipeline board +
 * calendar; clients get their "My bookings" view. Both read the current session.
 */
import { useQuery } from "@tanstack/react-query";
import { useCurrentProfile, useInkdClient, getCurrentArtistProfile } from "@inkd/core";
import { Skeleton } from "@inkd/ui/web";
import { ArtistBookings } from "./artist-bookings";
import { ClientBookings } from "./client-bookings";

export function BookingsHub() {
  const client = useInkdClient();
  const profileQ = useCurrentProfile();
  const artistQ = useQuery({
    queryKey: ["currentArtistProfile"],
    queryFn: () => getCurrentArtistProfile(client),
  });

  if (profileQ.isLoading || artistQ.isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-9 w-48" />
        <div className="grid gap-3 sm:grid-cols-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (artistQ.data) {
    return (
      <ArtistBookings
        artistId={artistQ.data.id}
        artistProfileId={profileQ.data?.id ?? ""}
      />
    );
  }

  return <ClientBookings clientId={profileQ.data?.id ?? ""} />;
}
