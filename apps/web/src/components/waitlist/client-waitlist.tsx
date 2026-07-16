"use client";

/**
 * Client waitlist manager (/bookings/waitlist): any live "a spot opened up"
 * offers first (claim / pass, with a countdown), then the client's standing
 * waitlist entries (leave anytime). Enriches offers/entries with artist +
 * service names via a single embedded read (RLS-safe: unreadable rows come back
 * null and fall back to generic labels).
 */
import { useQuery } from "@tanstack/react-query";
import { useInkdClient } from "@inkd/core";
import {
  useClientWaitlistOffers,
  useClientWaitlistEntries,
  useClaimWaitlistOffer,
  useDeclineWaitlistOffer,
  useCancelWaitlistEntry,
} from "@inkd/core";
import { Card, EmptyState, Eyebrow, Icon, Skeleton, useToast } from "@inkd/ui/web";
import { WaitlistOfferCard, WaitlistEntryRow } from "./shared";

type NameMap = Record<string, { artist?: string | null; service?: string | null }>;

function useEnriched(clientId: string) {
  const client = useInkdClient();
  return useQuery({
    queryKey: ["waitlist", "clientNames", clientId],
    enabled: Boolean(clientId),
    queryFn: async (): Promise<{ offers: NameMap; entries: NameMap }> => {
      const [offers, entries] = await Promise.all([
        client
          .from("waitlist_offers")
          .select("id, artist_profiles(profiles(display_name)), services(name)")
          .eq("client_id", clientId),
        client
          .from("waitlist_entries")
          .select("id, artist_profiles(profiles(display_name)), services(name)")
          .eq("client_id", clientId),
      ]);
      const toMap = (rows: unknown): NameMap => {
        const map: NameMap = {};
        for (const r of (rows as any[]) ?? []) {
          map[r.id] = {
            artist: r.artist_profiles?.profiles?.display_name ?? null,
            service: r.services?.name ?? null,
          };
        }
        return map;
      };
      return {
        offers: toMap((offers as any).data),
        entries: toMap((entries as any).data),
      };
    },
  });
}

export function ClientWaitlist({ clientId }: { clientId: string }) {
  const { toast } = useToast();
  const offersQ = useClientWaitlistOffers(clientId);
  const entriesQ = useClientWaitlistEntries(clientId);
  const namesQ = useEnriched(clientId);
  const claim = useClaimWaitlistOffer(clientId);
  const decline = useDeclineWaitlistOffer(clientId);
  const cancel = useCancelWaitlistEntry(clientId);

  const names = namesQ.data;

  if (offersQ.isLoading || entriesQ.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const offers = offersQ.data ?? [];
  const entries = entriesQ.data ?? [];

  const onClaim = (offerId: string) =>
    claim.mutate(offerId, {
      onSuccess: () => toast({ title: "Spot claimed — check your bookings", variant: "success" }),
      onError: (e: unknown) =>
        toast({ title: (e as Error).message ?? "Could not claim", variant: "danger" }),
    });
  const onDecline = (offerId: string) =>
    decline.mutate(offerId, {
      onSuccess: () => toast({ title: "Passed — offered to the next person" }),
    });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Eyebrow>Waitlist</Eyebrow>
        <h1 className="text-2xl font-semibold text-content">Your waitlist</h1>
        <p className="text-sm text-content-muted">
          When a booked spot frees up that matches what you asked for, you get first dibs.
        </p>
      </div>

      {offers.length > 0 ? (
        <section className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-content">Spots open now</p>
          {offers.map((o) => (
            <WaitlistOfferCard
              key={o.id}
              offer={{
                id: o.id,
                artistName: names?.offers[o.id]?.artist ?? "your artist",
                serviceName: names?.offers[o.id]?.service ?? null,
                slotStart: o.slot_start,
                expiresAt: o.expires_at,
              }}
              busy={claim.isPending || decline.isPending}
              onClaim={() => onClaim(o.id)}
              onDecline={() => onDecline(o.id)}
            />
          ))}
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-content">You&apos;re waiting for</p>
        {entries.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Icon name="clock" size={24} />}
              title="Not on any waitlists"
              description="Join an artist's waitlist from their profile when your ideal time is booked."
            />
          </Card>
        ) : (
          entries.map((e) => (
            <WaitlistEntryRow
              key={e.id}
              entry={{
                id: e.id,
                artistName: names?.entries[e.id]?.artist ?? "Artist",
                serviceName: names?.entries[e.id]?.service ?? null,
                status: e.status,
                earliestDate: e.earliest_date,
                latestDate: e.latest_date,
                preferredWeekdays: e.preferred_weekdays,
                preferredTimeStart: e.preferred_time_start,
                preferredTimeEnd: e.preferred_time_end,
                note: e.note,
              }}
              busy={cancel.isPending}
              onCancel={() => cancel.mutate(e.id)}
            />
          ))
        )}
      </section>
    </div>
  );
}
