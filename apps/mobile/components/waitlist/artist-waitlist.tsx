/**
 * Artist waitlist view (mobile): enable/disable toggle, offers currently out,
 * a "freed slots you can offer" list (future cancelled sessions), and the
 * standing waitlist ranked by priority then FIFO.
 */
import { useState } from "react";
import { Text, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useInkdClient,
  useArtistWaitlistEntries,
  useArtistWaitlistOffers,
  useOpenSessionToWaitlist,
  useSetWaitlistEnabled,
} from "@inkd/core";
import { Badge, Button, Card, EmptyState, Eyebrow, Icon, Skeleton, Toggle, useToast } from "@inkd/ui/native";
import { WaitlistEntryCard, formatSlot } from "./shared";

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
        .select("id, scheduled_start")
        .eq("artist_id", artistId)
        .eq("status", "cancelled")
        .gt("scheduled_start", new Date().toISOString())
        .order("scheduled_start", { ascending: true });
      return (data as { id: string; scheduled_start: string }[]) ?? [];
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
      onSuccess: () => toast({ title: v ? "Waitlist on" : "Waitlist paused", variant: "success" }),
      onError: () => setEnabled(!v),
    });
  };

  const openSlot = (sessionId: string) =>
    openM.mutate(sessionId, {
      onSuccess: (openingId) => {
        toast({ title: openingId ? "Offered to your waitlist" : "No one on the waitlist matched" });
        qc.invalidateQueries({ queryKey: ["waitlist", "cancelledSessions", artistId] });
      },
      onError: (e: unknown) => toast({ title: (e as Error).message ?? "Could not open slot", variant: "danger" }),
    });

  const entries = entriesQ.data ?? [];
  const offers = offersQ.data ?? [];
  const cancelled = cancelledQ.data ?? [];

  return (
    <View className="gap-6">
      <View className="flex-row items-start justify-between gap-4">
        <View className="flex-1">
          <Eyebrow>Waitlist</Eyebrow>
          <Text className="text-2xl font-semibold text-content-primary">Cancellation waitlist</Text>
          <Text className="text-sm text-content-secondary">
            When you cancel a session, the freed spot is auto-offered to the best match.
          </Text>
        </View>
        <Toggle checked={enabled} onCheckedChange={toggle} label="Waitlist enabled" />
      </View>

      {offers.length > 0 ? (
        <View className="gap-3">
          <Text className="text-sm font-semibold text-content-primary">Offers out now</Text>
          {offers.map((o) => (
            <Card key={o.id}>
              <View className="flex-row items-center justify-between gap-3">
                <View>
                  <Text className="text-sm font-medium text-content-primary">{formatSlot(o.slot_start)}</Text>
                  <Text className="text-xs text-content-muted">Awaiting a response</Text>
                </View>
                <Badge variant="brand">Pending</Badge>
              </View>
            </Card>
          ))}
        </View>
      ) : null}

      {cancelled.length > 0 ? (
        <View className="gap-3">
          <Text className="text-sm font-semibold text-content-primary">Freed slots you can offer</Text>
          {cancelled.map((s) => (
            <Card key={s.id}>
              <View className="flex-row items-center justify-between gap-3">
                <Text className="text-sm font-medium text-content-primary">{formatSlot(s.scheduled_start)}</Text>
                <Button size="sm" onPress={() => openSlot(s.id)} disabled={openM.isPending}>
                  Offer to waitlist
                </Button>
              </View>
            </Card>
          ))}
        </View>
      ) : null}

      <View className="gap-3">
        <Text className="text-sm font-semibold text-content-primary">On your waitlist</Text>
        {entriesQ.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : entries.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Icon name="clock" size={24} />}
              title="No one waiting yet"
              description="Clients join your waitlist from your profile when a time they want is booked."
            />
          </Card>
        ) : (
          entries.map((e) => (
            <WaitlistEntryCard
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
      </View>
    </View>
  );
}
