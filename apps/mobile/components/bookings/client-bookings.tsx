/**
 * Client "My bookings": submitted requests (with withdraw) and confirmed
 * bookings (with per-policy cancel), plus links into each booking's detail.
 */
import { Text, View } from "react-native";
import { router } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useClientBookingRequests,
  useClientBookings,
  useInkdClient,
  setBookingRequestStatus,
  setBookingStatus,
  REQUEST_STATUS_META,
  BOOKING_STATUS_META,
  isRequestOpen,
  isBookingCancellable,
  formatBudget,
  type BookingRequest,
  type Booking,
} from "@inkd/core";
import { Button, Card, EmptyState, Eyebrow, Icon, useToast } from "@inkd/ui/native";
import { StatusBadge, formatDay } from "./shared";

export function ClientBookings({ clientId }: { clientId: string }) {
  const requestsQ = useClientBookingRequests(clientId);
  const bookingsQ = useClientBookings(clientId);
  const client = useInkdClient();
  const qc = useQueryClient();
  const { toast } = useToast();

  const withdraw = useMutation({
    mutationFn: (id: string) => setBookingRequestStatus(client, id, "withdrawn"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookingRequests", "client", clientId] });
      toast({ title: "Request withdrawn", variant: "info" });
    },
  });

  const cancelBooking = useMutation({
    mutationFn: (id: string) => setBookingStatus(client, id, "cancelled"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookings", "client", clientId] });
      toast({ title: "Booking cancelled", variant: "info" });
    },
  });

  const requests = requestsQ.data ?? [];
  const bookings = bookingsQ.data ?? [];
  const openRequests = requests.filter((r) => isRequestOpen(r.status));
  const pastRequests = requests.filter((r) => !isRequestOpen(r.status) && r.status !== "converted");

  const nothing =
    !requestsQ.isLoading &&
    !bookingsQ.isLoading &&
    requests.length === 0 &&
    bookings.length === 0;

  return (
    <View className="gap-8">
      <View className="gap-2">
        <Eyebrow>Your chair</Eyebrow>
        <Text className="font-display text-3xl text-content-primary">My bookings</Text>
        <Text className="text-content-secondary">
          Track requests you&apos;ve sent, upcoming sessions, and everything you&apos;ve booked.
        </Text>
      </View>

      {nothing ? (
        <Card padding="none" className="overflow-hidden">
          <EmptyState
            icon={<Icon name="calendar" size={26} color="#71717A" />}
            title="No bookings yet"
            description="Find an artist you love and send your first request — it lands here while they review it."
            action={
              <Button
                size="sm"
                leadingIcon={<Icon name="compass" size={16} color="#FAFAFA" />}
                onPress={() => router.push("/(tabs)/discover")}
              >
                Discover artists
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          {/* Confirmed bookings */}
          <View className="gap-3">
            <Text className="font-mono text-[11px] uppercase tracking-[0.18em] text-content-muted">
              Bookings
            </Text>
            {bookings.length === 0 ? (
              <Text className="text-sm text-content-muted">
                Nothing booked yet — requests you send show below.
              </Text>
            ) : (
              <View className="gap-3">
                {bookings.map((b) => (
                  <ClientBookingRow
                    key={b.id}
                    booking={b}
                    onCancel={() => cancelBooking.mutate(b.id)}
                    cancelling={cancelBooking.isPending}
                  />
                ))}
              </View>
            )}
          </View>

          {/* Requests */}
          <View className="gap-3">
            <Text className="font-mono text-[11px] uppercase tracking-[0.18em] text-content-muted">
              Requests
            </Text>
            {openRequests.length === 0 && pastRequests.length === 0 ? (
              <Text className="text-sm text-content-muted">No pending requests.</Text>
            ) : (
              <View className="gap-3">
                {openRequests.map((r) => (
                  <ClientRequestRow
                    key={r.id}
                    request={r}
                    onWithdraw={() => withdraw.mutate(r.id)}
                    withdrawing={withdraw.isPending}
                  />
                ))}
                {pastRequests.map((r) => (
                  <ClientRequestRow key={r.id} request={r} />
                ))}
              </View>
            )}
          </View>
        </>
      )}
    </View>
  );
}

function ClientBookingRow({
  booking,
  onCancel,
  cancelling,
}: {
  booking: Booking;
  onCancel: () => void;
  cancelling: boolean;
}) {
  const meta = BOOKING_STATUS_META[booking.status];
  return (
    <Card padding="md" className="gap-3">
      <View className="flex-row items-center gap-2">
        <Text className="flex-1 font-display text-base text-content-primary" numberOfLines={1}>
          {booking.title ?? "Tattoo project"}
        </Text>
        <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
      </View>
      <Text className="font-mono text-xs text-content-muted">
        Updated {formatDay(booking.updated_at)}
      </Text>
      <View className="flex-row items-center gap-2">
        {isBookingCancellable(booking.status) && (
          <Button variant="ghost" size="sm" onPress={onCancel} loading={cancelling}>
            Cancel
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onPress={() => router.push(`/bookings/${booking.id}`)}
        >
          View
        </Button>
      </View>
    </Card>
  );
}

function ClientRequestRow({
  request,
  onWithdraw,
  withdrawing,
}: {
  request: BookingRequest;
  onWithdraw?: () => void;
  withdrawing?: boolean;
}) {
  const meta = REQUEST_STATUS_META[request.status];
  return (
    <Card padding="md" className="gap-3">
      <View className="flex-row items-center gap-2">
        <Text className="flex-1 font-display text-base text-content-primary" numberOfLines={1}>
          {request.placement || request.description?.slice(0, 40) || "Custom project"}
        </Text>
        <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
      </View>
      <Text className="font-mono text-xs text-content-muted">
        Sent {formatDay(request.created_at)} · Budget{" "}
        {formatBudget(request.budget_min_cents, request.budget_max_cents)}
      </Text>
      {onWithdraw && (
        <Button variant="ghost" size="sm" onPress={onWithdraw} loading={withdrawing}>
          Withdraw
        </Button>
      )}
    </Card>
  );
}
