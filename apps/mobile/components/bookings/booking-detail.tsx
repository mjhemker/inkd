/**
 * Booking detail — shared by artist and client, gated by role. Client info,
 * intake + references (from the originating request), the sessions list with
 * per-session deposit/balance state off the payments ledger, add-session,
 * reschedule/cancel/complete, and booking-level status transitions.
 */
import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import * as Linking from "expo-linking";
import { Link } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import {
  useInkdClient,
  useBooking,
  useBookingSessions,
  useBookingPayments,
  useSetBookingStatus,
  useCreateSession,
  useUpdateSession,
  getCurrentArtistProfile,
  getBookingRequest,
  getProfileById,
  requestDeposit,
  sessionDepositState,
  summarizeBookingMoney,
  BOOKING_STATUS_META,
  SESSION_STATUS_META,
  DEPOSIT_STATE_META,
  bookingStage,
  isBookingCancellable,
  formatCents,
  useBookingReview,
  useCreateReview,
  useUpdateReview,
  useSetArtistReviewResponse,
  isReviewEditable,
  type Session,
  type Payment,
  type BookingStatus,
} from "@inkd/core";
import {
  Avatar,
  Button,
  Card,
  Divider,
  FormField,
  Icon,
  Input,
  Modal,
  Skeleton,
  useToast,
} from "@inkd/ui/native";
import {
  DetailSection,
  IntakeRow,
  NotFound,
  ReferencesGallery,
  StatusBadge,
  formatDateTime,
  formatDay,
  toRefs,
} from "./shared";
import { ArtistResponseForm } from "../reviews/artist-response-form";
import { ReviewCard } from "../reviews/review-card";
import { ReviewFormModal, type ReviewFormValues } from "../reviews/review-form-modal";

export function BookingDetail({ bookingId }: { bookingId: string }) {
  const client = useInkdClient();
  const { toast } = useToast();
  const bookingQ = useBooking(bookingId);
  const sessionsQ = useBookingSessions(bookingId);
  const paymentsQ = useBookingPayments(bookingId);
  const artistQ = useQuery({
    queryKey: ["currentArtistProfile"],
    queryFn: () => getCurrentArtistProfile(client),
  });

  const booking = bookingQ.data ?? null;
  const isArtist = Boolean(booking && artistQ.data?.id === booking.artist_id);
  const artistId = booking?.artist_id ?? "";

  const requestQ = useQuery({
    queryKey: ["bookingRequest", booking?.request_id],
    queryFn: () => (booking?.request_id ? getBookingRequest(client, booking.request_id) : null),
    enabled: Boolean(booking?.request_id),
  });
  const clientQ = useQuery({
    queryKey: ["profile", booking?.client_id],
    queryFn: () => (booking ? getProfileById(client, booking.client_id) : null),
    enabled: Boolean(booking?.client_id),
  });

  const setStatus = useSetBookingStatus(artistId);
  const createSession = useCreateSession(artistId);
  const updateSession = useUpdateSession(artistId);

  const reviewQ = useBookingReview(booking?.id);
  const review = reviewQ.data ?? null;
  const createReview = useCreateReview({ artistId, clientId: booking?.client_id, bookingId: booking?.id });
  const updateReviewMut = useUpdateReview({ artistId, clientId: booking?.client_id, bookingId: booking?.id });
  const setResponse = useSetArtistReviewResponse({ artistId, bookingId: booking?.id });
  const [reviewModalOpen, setReviewModalOpen] = useState(false);

  const [reschedule, setReschedule] = useState<{ id: string; value: string } | null>(null);
  const [depositBusy, setDepositBusy] = useState<string | null>(null);

  const sessions = useMemo(
    () => [...(sessionsQ.data ?? [])].sort((a, b) => a.session_number - b.session_number),
    [sessionsQ.data],
  );
  const payments = useMemo(() => paymentsQ.data ?? [], [paymentsQ.data]);
  const money = useMemo(() => summarizeBookingMoney(sessions, payments), [sessions, payments]);

  if (bookingQ.isLoading) return <DetailSkeleton />;
  if (!booking) {
    return <NotFound title="Booking not found" body="It may have been cancelled or you don't have access." />;
  }

  const meta = BOOKING_STATUS_META[booking.status];
  const stage = bookingStage(booking);
  const refs = toRefs(requestQ.data?.reference_uploads ?? []);
  const clientName = clientQ.data?.display_name ?? clientQ.data?.handle ?? "Client";

  async function onRequestDeposit(session: Session) {
    setDepositBusy(session.id);
    try {
      const { url } = await requestDeposit(client, session.id);
      await Linking.openURL(url);
      toast({ title: "Deposit checkout opened", variant: "success" });
    } catch {
      toast({
        title: "Couldn't start checkout",
        description: "The payments service isn't connected yet.",
        variant: "danger",
      });
    } finally {
      setDepositBusy(null);
    }
  }

  async function saveReschedule() {
    if (!reschedule) return;
    const start = new Date(reschedule.value);
    if (Number.isNaN(start.getTime())) {
      toast({ title: "Invalid date", description: "Use YYYY-MM-DDTHH:MM", variant: "danger" });
      return;
    }
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
    try {
      await updateSession.mutateAsync({
        id: reschedule.id,
        patch: {
          scheduled_start: start.toISOString(),
          scheduled_end: end.toISOString(),
          status: "scheduled",
        },
      });
      setReschedule(null);
      toast({ title: "Session scheduled", variant: "success" });
    } catch (err) {
      toast({
        title: "Couldn't reschedule",
        description: err instanceof Error ? err.message : undefined,
        variant: "danger",
      });
    }
  }

  async function addSession() {
    if (!booking) return;
    const lastNumber = sessions.length > 0 ? sessions[sessions.length - 1]?.session_number ?? 0 : 0;
    const nextNum = lastNumber + 1;
    try {
      await createSession.mutateAsync({
        booking_id: booking.id,
        client_id: booking.client_id,
        session_number: nextNum,
      });
      toast({ title: `Session #${nextNum} added`, variant: "success" });
    } catch (err) {
      toast({
        title: "Couldn't add session",
        description: err instanceof Error ? err.message : undefined,
        variant: "danger",
      });
    }
  }

  async function submitReview(values: ReviewFormValues) {
    if (!booking) return;
    try {
      if (review) {
        await updateReviewMut.mutateAsync({
          id: review.id,
          patch: { rating: values.rating, title: values.title || null, body: values.body || null },
        });
        toast({ title: "Review updated", variant: "success" });
      } else {
        await createReview.mutateAsync({
          artist_id: artistId,
          booking_id: booking.id,
          rating: values.rating,
          title: values.title || null,
          body: values.body || null,
        });
        toast({ title: "Review submitted — thanks!", variant: "success" });
      }
      setReviewModalOpen(false);
    } catch (err) {
      toast({
        title: "Couldn't save review",
        description: err instanceof Error ? err.message : undefined,
        variant: "danger",
      });
    }
  }

  async function submitResponse(response: string) {
    if (!review) return;
    try {
      await setResponse.mutateAsync({ id: review.id, response });
      toast({ title: "Response posted", variant: "success" });
    } catch (err) {
      toast({
        title: "Couldn't post response",
        description: err instanceof Error ? err.message : undefined,
        variant: "danger",
      });
    }
  }

  return (
    <View className="gap-6">
      <View className="gap-3">
        <Text className="font-mono text-xs uppercase tracking-widest text-content-muted">
          {isArtist ? "Studio · Booking" : "Your booking"}
        </Text>
        <View className="flex-row flex-wrap items-center gap-2">
          <Text className="font-display text-2xl text-content-primary">
            {booking.title ?? "Tattoo project"}
          </Text>
          <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
        </View>
        <Text className="font-mono text-xs text-content-muted">
          Started {formatDay(booking.created_at)} · Stage: {stage.replace("_", " ")}
        </Text>
      </View>

      {/* Money summary */}
      <View className="flex-row gap-3">
        <MoneyTile
          label="Deposits"
          value={formatCents(money.depositPaidCents)}
          sub={`of ${formatCents(money.depositCents)}`}
        />
        <MoneyTile label="Collected" value={formatCents(money.collectedCents)} sub="settled" />
        <MoneyTile label="Outstanding" value={formatCents(money.outstandingCents)} sub="remaining" />
      </View>

      {/* Client */}
      <Card padding="md" className="flex-row items-center gap-3">
        <Avatar name={clientName} src={clientQ.data?.avatar_url ?? undefined} size="md" />
        <View className="flex-1">
          <Text className="font-sans-semibold text-content-primary">
            {isArtist ? clientName : "You"}
          </Text>
          <Text className="font-mono text-xs text-content-muted" numberOfLines={1}>
            {clientQ.data?.city ?? "Client"} · {sessions.length} session
            {sessions.length === 1 ? "" : "s"}
          </Text>
        </View>
      </Card>

      {/* Intake + references */}
      {requestQ.data && (
        <DetailSection title="Intake">
          <Card padding="lg" className="gap-3">
            {requestQ.data.placement && <IntakeRow label="Placement" value={requestQ.data.placement} />}
            {requestQ.data.size_description && (
              <IntakeRow label="Size" value={requestQ.data.size_description} />
            )}
            {requestQ.data.description && <IntakeRow label="Idea" value={requestQ.data.description} />}
            {requestQ.data.has_medical_flags && (
              <IntakeRow label="Medical" value={requestQ.data.medical_notes || "Disclosed"} tone="warning" />
            )}
          </Card>
        </DetailSection>
      )}
      {refs.length > 0 && (
        <DetailSection title="References">
          <ReferencesGallery refs={refs} />
        </DetailSection>
      )}

      {/* Sessions */}
      <DetailSection
        title="Sessions"
        action={
          isArtist ? (
            <Button
              size="sm"
              variant="ghost"
              onPress={addSession}
              loading={createSession.isPending}
              leadingIcon={<Icon name="plus" size={15} color="#D4D4D8" />}
            >
              Add session
            </Button>
          ) : undefined
        }
      >
        <View className="gap-3">
          {sessions.length === 0 ? (
            <Text className="text-sm text-content-muted">No sessions yet.</Text>
          ) : (
            sessions.map((s) => (
              <SessionCard
                key={s.id}
                session={s}
                payments={payments}
                isArtist={isArtist}
                depositBusy={depositBusy === s.id}
                onRequestDeposit={() => onRequestDeposit(s)}
                onReschedule={() => setReschedule({ id: s.id, value: toLocalInput(s.scheduled_start) })}
                onMarkDeposit={() =>
                  updateSession.mutate({ id: s.id, patch: { deposit_paid: !s.deposit_paid } })
                }
                onComplete={() => updateSession.mutate({ id: s.id, patch: { status: "completed" } })}
                onCancel={() => updateSession.mutate({ id: s.id, patch: { status: "cancelled" } })}
              />
            ))
          )}
          {sessions.length > 0 && (
            <Link href={`/waivers/sign/${booking.id}`} asChild>
              <Pressable className="flex-row items-center justify-between rounded-lg border border-border-subtle px-3.5 py-3">
                <View className="flex-row items-center gap-2.5">
                  <Icon name="shield" size={16} color="#D4D4D8" />
                  <Text className="text-sm text-content-primary">
                    {isArtist
                      ? "Consent form — review or send"
                      : "Sign your consent form"}
                  </Text>
                </View>
                <Icon name="chevron-right" size={16} color="#71717A" />
              </Pressable>
            </Link>
          )}
        </View>
      </DetailSection>

      {/* Review — client leaves one on a healed booking; artist may respond */}
      {booking.status === "completed" && (
        <>
          <Divider />
          <DetailSection title="Review">
            {!isArtist &&
              (review ? (
                <Card padding="lg" className="gap-3">
                  <ReviewCard review={review} reviewerName="You" reviewerAvatarUrl={clientQ.data?.avatar_url} />
                  {isReviewEditable(review) && (
                    <Button size="sm" variant="ghost" className="self-start" onPress={() => setReviewModalOpen(true)}>
                      Edit review
                    </Button>
                  )}
                </Card>
              ) : (
                <Card padding="lg" className="flex-row flex-wrap items-center justify-between gap-3">
                  <View className="flex-1 gap-0.5">
                    <Text className="text-sm font-semibold text-content-primary">How was your session?</Text>
                    <Text className="text-sm text-content-muted">
                      Leave a rating and a few words for other clients.
                    </Text>
                  </View>
                  <Button
                    size="sm"
                    onPress={() => setReviewModalOpen(true)}
                    leadingIcon={<Icon name="star" size={15} color="#FAFAFA" />}
                  >
                    Leave a review
                  </Button>
                </Card>
              ))}
            {isArtist &&
              (review ? (
                <Card padding="lg" className="gap-3">
                  <ReviewCard review={review} reviewerName={clientName} reviewerAvatarUrl={clientQ.data?.avatar_url} />
                  <ArtistResponseForm
                    initialResponse={review.artist_response}
                    submitting={setResponse.isPending}
                    onSubmit={submitResponse}
                  />
                </Card>
              ) : (
                <Text className="text-sm text-content-muted">{clientName} hasn&apos;t left a review yet.</Text>
              ))}
          </DetailSection>
        </>
      )}

      {/* Booking-level actions (artist) */}
      {isArtist && isBookingCancellable(booking.status) && (
        <>
          <Divider />
          <DetailSection title="Booking status">
            <View className="flex-row flex-wrap gap-2">
              <StatusButton current={booking.status} target="confirmed" label="Mark scheduled" onClick={setStatus} id={booking.id} />
              <StatusButton current={booking.status} target="in_progress" label="Start work" onClick={setStatus} id={booking.id} />
              <StatusButton current={booking.status} target="completed" label="Mark healed" onClick={setStatus} id={booking.id} />
              <Button
                variant="ghost"
                size="sm"
                onPress={() => setStatus.mutate({ id: booking.id, status: "cancelled" })}
                loading={setStatus.isPending}
              >
                Cancel booking
              </Button>
            </View>
          </DetailSection>
        </>
      )}

      {/* Reschedule modal */}
      <Modal
        open={reschedule != null}
        onClose={() => setReschedule(null)}
        title="Schedule session"
        description="Set the date and start time (YYYY-MM-DDTHH:MM). The client is notified of the change."
        footer={
          <>
            <Button variant="ghost" onPress={() => setReschedule(null)}>
              Cancel
            </Button>
            <Button onPress={saveReschedule} loading={updateSession.isPending}>
              Save
            </Button>
          </>
        }
      >
        <FormField label="Date & time">
          <Input
            value={reschedule?.value ?? ""}
            onChangeText={(v) => setReschedule((r) => (r ? { ...r, value: v } : r))}
            placeholder="2026-08-01T14:00"
            autoCapitalize="none"
          />
        </FormField>
      </Modal>

      {/* Leave / edit review modal */}
      <ReviewFormModal
        open={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        mode={review ? "edit" : "create"}
        initial={review ? { rating: review.rating, title: review.title ?? "", body: review.body ?? "" } : undefined}
        onSubmit={submitReview}
        submitting={createReview.isPending || updateReviewMut.isPending}
      />
    </View>
  );
}

function toLocalInput(iso: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function SessionCard({
  session,
  payments,
  isArtist,
  depositBusy,
  onRequestDeposit,
  onReschedule,
  onMarkDeposit,
  onComplete,
  onCancel,
}: {
  session: Session;
  payments: Payment[];
  isArtist: boolean;
  depositBusy: boolean;
  onRequestDeposit: () => void;
  onReschedule: () => void;
  onMarkDeposit: () => void;
  onComplete: () => void;
  onCancel: () => void;
}) {
  const sMeta = SESSION_STATUS_META[session.status];
  const depositState = sessionDepositState(session, payments);
  const dMeta = DEPOSIT_STATE_META[depositState];
  const terminal = session.status === "completed" || session.status === "cancelled";
  const showDeposit = depositState === "due" || depositState === "requested" || depositState === "overdue";

  return (
    <Card padding="md" className="gap-3">
      <View className="flex-row flex-wrap items-center gap-3">
        <View className="h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-overlay">
          <Text className="font-mono text-sm text-content-accent">{session.session_number}</Text>
        </View>
        <View className="flex-1 gap-1">
          <Text className="font-sans-semibold text-content-primary">
            {formatDateTime(session.scheduled_start)}
          </Text>
          <View className="flex-row flex-wrap items-center gap-1.5">
            <StatusBadge tone={sMeta.tone}>{sMeta.label}</StatusBadge>
            {session.deposit_cents > 0 && <StatusBadge tone={dMeta.tone}>{dMeta.label}</StatusBadge>}
          </View>
        </View>
        {session.deposit_cents > 0 && (
          <Text className="font-mono text-sm text-content-secondary">
            {formatCents(session.deposit_cents)} dep
          </Text>
        )}
      </View>

      {isArtist && !terminal && (
        <View className="flex-row flex-wrap gap-2 border-t border-border-subtle pt-3">
          <Button
            size="sm"
            variant="outline"
            onPress={onReschedule}
            leadingIcon={<Icon name="calendar" size={15} color="#D4D4D8" />}
          >
            {session.scheduled_start ? "Reschedule" : "Schedule"}
          </Button>
          {showDeposit && (
            <Button
              size="sm"
              variant="secondary"
              onPress={onRequestDeposit}
              loading={depositBusy}
              leadingIcon={<Icon name="credit-card" size={15} color="#FAFAFA" />}
            >
              Request deposit
            </Button>
          )}
          {session.deposit_cents > 0 && (
            <Button size="sm" variant="ghost" onPress={onMarkDeposit}>
              {session.deposit_paid ? "Unmark deposit" : "Mark deposit paid"}
            </Button>
          )}
          <Button size="sm" variant="ghost" onPress={onComplete}>
            Complete
          </Button>
          <Button size="sm" variant="ghost" onPress={onCancel}>
            Cancel
          </Button>
        </View>
      )}

      {!isArtist && showDeposit && (
        <View className="flex-row items-center justify-between gap-3 border-t border-border-subtle pt-3">
          <Text className="flex-1 text-sm text-content-secondary">
            {depositState === "overdue" ? "Your deposit is overdue." : "A deposit holds your slot."}
          </Text>
          <Button
            size="sm"
            onPress={onRequestDeposit}
            loading={depositBusy}
            leadingIcon={<Icon name="credit-card" size={15} color="#FAFAFA" />}
          >
            Pay deposit
          </Button>
        </View>
      )}
    </Card>
  );
}

function StatusButton({
  current,
  target,
  label,
  onClick,
  id,
}: {
  current: BookingStatus;
  target: BookingStatus;
  label: string;
  onClick: ReturnType<typeof useSetBookingStatus>;
  id: string;
}) {
  return (
    <Button
      size="sm"
      variant={current === target ? "secondary" : "outline"}
      disabled={current === target}
      loading={onClick.isPending}
      onPress={() => onClick.mutate({ id, status: target })}
    >
      {label}
    </Button>
  );
}

function MoneyTile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Card padding="md" className="flex-1 gap-0.5">
      <Text className="font-mono text-[10px] uppercase tracking-widest text-content-muted">{label}</Text>
      <Text className="font-display text-xl text-content-primary">{value}</Text>
      <Text className="text-xs text-content-muted">{sub}</Text>
    </Card>
  );
}

function DetailSkeleton() {
  return (
    <View className="gap-6">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-48 w-full" />
    </View>
  );
}
