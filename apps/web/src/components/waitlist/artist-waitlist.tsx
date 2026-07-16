"use client";

/**
 * Artist waitlist view: an enable/disable toggle, the standing waitlist (ranked
 * by priority then FIFO), the offers currently out, and a "manually open a
 * freed slot" list (future cancelled sessions) that pushes a slot to the
 * waitlist on demand. All reads are RLS-scoped to the artist.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useInkdClient } from "@inkd/core";
import {
  useArtistWaitlistEntries,
  useArtistWaitlistOffers,
  useOpenSessionToWaitlist,
  useSetWaitlistEnabled,
} from "@inkd/core";
import { Badge, Button, Card, EmptyState, Eyebrow, Icon, Skeleton, Toggle, useToast } from "@inkd/ui/web";
import { WaitlistEntryRow, formatSlot } from "./shared";

function useClientNames(artistId: string) {
  const client = useInkdClient();
  return useQuery({
    queryKey: ["waitlist", "artistClientNames", artistId],
    enabled: Boolean(artistId),
    queryFn: async () => {
      const { data } = await client
        .from("waitlist_entries")
        .select("id, profiles(display_name), services(name)")
        .eq("artist_id", artistId);
      const map: Record<string, { client?: string | null; service?: string | null }> = {};
      for (const r of (data as any[]) ?? []) {
        map[r.id] = { client: r.profiles?.display_name ?? null, service: r.services?.name ?? null };
      }
      return map;
    },
  });
}

function useCancelledFutureSessions(artistId: string) {
  const client = useInkdClient();
  return useQuery({
    queryKey: ["waitlist", "cancelledSessions", artistId],
    enabled: Boolean(artistId),
    queryFn: async () => {
      const { data } = await client
        .from("sessions")
        .select("id, scheduled_start, scheduled_end")
        .eq("artist_id", artistId)
        .eq("status", "cancelled")
        .gt("scheduled_start", new Date().toISOString())
        .order("scheduled_start", { ascending: true });
      return (data as { id: string; scheduled_start: string; scheduled_end: string | null }[]) ?? [];
    },
  });
}

export function ArtistWaitlist({
  artistId,
  waitlistEnabled = true,
}: {
  artistId: string;
  waitlistEnabled?: boolean;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [enabled, setEnabled] = useState(waitlistEnabled);
  const entriesQ = useArtistWaitlistEntries(artistId);
  const offersQ = useArtistWaitlistOffers(artistId);
  const namesQ = useClientNames(artistId);
  const cancelledQ = useCancelledFutureSessions(artistId);
  const setEnabledM = useSetWaitlistEnabled(artistId);
  const openM = useOpenSessionToWaitlist(artistId);

  const names = namesQ.data;

  const toggle = (v: boolean) => {
    setEnabled(v);
    setEnabledM.mutate(v, {
      onSuccess: () =>
        toast({ title: v ? "Waitlist on" : "Waitlist paused", variant: "success" }),
      onError: () => setEnabled(!v),
    });
  };

  const openSlot = (sessionId: string) =>
    openM.mutate(sessionId, {
      onSuccess: (openingId) => {
        toast({
          title: openingId ? "Offered to your waitlist" : "No one on the waitlist matched",
        });
        qc.invalidateQueries({ queryKey: ["waitlist", "cancelledSessions", artistId] });
      },
      onError: (e: unknown) =>
        toast({ title: (e as Error).message ?? "Could not open slot", variant: "danger" }),
    });

  const entries = entriesQ.data ?? [];
  const offers = offersQ.data ?? [];
  const cancelled = cancelledQ.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Eyebrow>Waitlist</Eyebrow>
          <h1 className="text-2xl font-semibold text-content">Cancellation waitlist</h1>
          <p className="text-sm text-content-muted">
            When you cancel a session, the freed spot is auto-offered to the best-matching client.
          </p>
        </div>
        <Toggle checked={enabled} onCheckedChange={toggle} label="Waitlist enabled" />
      </div>

      {!enabled ? (
        <Card>
          <div className="flex items-center gap-3 p-4 text-sm text-content-muted">
            <Icon name="alert-triangle" size={18} />
            Waitlist is paused — freed slots won&apos;t be auto-offered.
          </div>
        </Card>
      ) : null}

      {offers.length > 0 ? (
        <section className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-content">Offers out now</p>
          {offers.map((o) => (
            <Card key={o.id}>
              <div className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="text-sm font-medium text-content">{formatSlot(o.slot_start)}</p>
                  <p className="text-xs text-content-muted">Awaiting a response</p>
                </div>
                <Badge variant="brand">Pending</Badge>
              </div>
            </Card>
          ))}
        </section>
      ) : null}

      {cancelled.length > 0 ? (
        <section className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-content">Freed slots you can offer</p>
          {cancelled.map((s) => (
            <Card key={s.id}>
              <div className="flex items-center justify-between gap-3 p-4">
                <p className="text-sm font-medium text-content">{formatSlot(s.scheduled_start)}</p>
                <Button size="sm" onClick={() => openSlot(s.id)} disabled={openM.isPending}>
                  Offer to waitlist
                </Button>
              </div>
            </Card>
          ))}
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-content">On your waitlist</p>
        {entriesQ.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : entries.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Icon name="clock" size={24} />}
              title="No one waiting yet"
              description="Clients can join your waitlist from your profile when they want a time that's booked."
            />
          </Card>
        ) : (
          entries.map((e) => (
            <WaitlistEntryRow
              key={e.id}
              showClient
              entry={{
                id: e.id,
                clientName: names?.[e.id]?.client ?? "Client",
                serviceName: names?.[e.id]?.service ?? null,
                status: e.status,
                earliestDate: e.earliest_date,
                latestDate: e.latest_date,
                preferredWeekdays: e.preferred_weekdays,
                preferredTimeStart: e.preferred_time_start,
                preferredTimeEnd: e.preferred_time_end,
                note: e.note,
                priority: e.priority,
              }}
            />
          ))
        )}
      </section>
    </div>
  );
}
