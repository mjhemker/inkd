"use client";

/**
 * Client "My bookings": submitted requests (with withdraw) and confirmed
 * bookings (with per-policy cancel), plus links into each booking's detail.
 */
import Link from "next/link";
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
import { Button, Card, EmptyState, Eyebrow, Icon, useToast } from "@inkd/ui/web";
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
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <Eyebrow>Your chair</Eyebrow>
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          My bookings
        </h1>
        <p className="max-w-xl text-content-secondary">
          Track requests you&apos;ve sent, upcoming sessions, and everything
          you&apos;ve booked.
        </p>
      </header>

      {nothing ? (
        <Card padding="none" className="overflow-hidden">
          <EmptyState
            className="py-14"
            icon={<Icon name="calendar" size={26} />}
            title="No bookings yet"
            description="Find an artist you love and send your first request — it lands here while they review it."
            action={
              <Link href="/discover">
                <Button size="sm" leadingIcon={<Icon name="compass" size={16} />}>
                  Discover artists
                </Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <>
          {/* Confirmed bookings */}
          <section className="flex flex-col gap-3">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-content-muted">
              Bookings
            </h2>
            {bookings.length === 0 ? (
              <p className="text-sm text-content-muted">
                Nothing booked yet — requests you send show below.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {bookings.map((b) => (
                  <ClientBookingRow
                    key={b.id}
                    booking={b}
                    onCancel={() => cancelBooking.mutate(b.id)}
                    cancelling={cancelBooking.isPending}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Open requests */}
          <section className="flex flex-col gap-3">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-content-muted">
              Requests
            </h2>
            {openRequests.length === 0 && pastRequests.length === 0 ? (
              <p className="text-sm text-content-muted">No pending requests.</p>
            ) : (
              <div className="flex flex-col gap-3">
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
              </div>
            )}
          </section>
        </>
      )}
    </div>
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
    <Card padding="md" className="flex flex-wrap items-center gap-4">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-display text-base font-bold tracking-tight">
            {booking.title ?? "Tattoo project"}
          </span>
          <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
        </div>
        <span className="font-mono text-xs text-content-muted">
          Updated {formatDay(booking.updated_at)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {isBookingCancellable(booking.status) && (
          <Button variant="ghost" size="sm" onClick={onCancel} loading={cancelling}>
            Cancel
          </Button>
        )}
        <Link href={`/bookings/${booking.id}`}>
          <Button variant="outline" size="sm" trailingIcon={<Icon name="chevron-right" size={15} />}>
            View
          </Button>
        </Link>
      </div>
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
    <Card padding="md" className="flex flex-wrap items-center gap-4">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-display text-base font-bold tracking-tight">
            {request.placement || request.description?.slice(0, 40) || "Custom project"}
          </span>
          <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
        </div>
        <span className="font-mono text-xs text-content-muted">
          Sent {formatDay(request.created_at)} · Budget{" "}
          {formatBudget(request.budget_min_cents, request.budget_max_cents)}
        </span>
      </div>
      {onWithdraw && (
        <Button variant="ghost" size="sm" onClick={onWithdraw} loading={withdrawing}>
          Withdraw
        </Button>
      )}
    </Card>
  );
}
