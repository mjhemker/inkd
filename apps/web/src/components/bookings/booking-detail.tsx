"use client";

/**
 * Booking detail — shared by artist and client, gated by role. Client info,
 * intake + references (from the originating request), the sessions list with
 * per-session deposit/balance state off the payments ledger, add-session,
 * reschedule/cancel/complete, and booking-level status transitions.
 */
import { useMemo, useState } from "react";
import Link from "next/link";
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
  Eyebrow,
  FormField,
  Icon,
  Input,
  Modal,
  Skeleton,
  useToast,
} from "@inkd/ui/web";
import {
  DetailSection,
  ReferencesGallery,
  StatusBadge,
  formatDateTime,
  formatDay,
  toRefs,
} from "./shared";
import { NotFound } from "./request-detail";
import { ArtistResponseForm } from "../reviews/artist-response-form";
import { ReviewCard } from "../reviews/review-card";
import { ReviewFormModal, type ReviewFormValues } from "../reviews/review-form-modal";
import { HealingSection } from "../aftercare/healing-section";

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
  const payments = paymentsQ.data ?? [];
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
      window.open(url, "_blank", "noopener");
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
      toast({ title: "Couldn't reschedule", description: err instanceof Error ? err.message : undefined, variant: "danger" });
    }
  }

  async function addSession() {
    if (!booking) return;
    const nextNum = (sessions[sessions.length - 1]?.session_number ?? 0) + 1;
    try {
      await createSession.mutateAsync({
        booking_id: booking.id,
        client_id: booking.client_id,
        session_number: nextNum,
      });
      toast({ title: `Session #${nextNum} added`, variant: "success" });
    } catch (err) {
      toast({ title: "Couldn't add session", description: err instanceof Error ? err.message : undefined, variant: "danger" });
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
      toast({ title: "Couldn't save review", description: err instanceof Error ? err.message : undefined, variant: "danger" });
    }
  }

  async function submitResponse(response: string) {
    if (!review) return;
    try {
      await setResponse.mutateAsync({ id: review.id, response });
      toast({ title: "Response posted", variant: "success" });
    } catch (err) {
      toast({ title: "Couldn't post response", description: err instanceof Error ? err.message : undefined, variant: "danger" });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <BackLink />

      <header className="flex flex-col gap-3">
        <Eyebrow>{isArtist ? "Studio · Booking" : "Your booking"}</Eyebrow>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            {booking.title ?? "Tattoo project"}
          </h1>
          <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
        </div>
        <span className="font-mono text-xs text-content-muted">
          Started {formatDay(booking.created_at)} · Stage: {stage.replace("_", " ")}
        </span>
      </header>

      {/* Money summary */}
      <div className="grid grid-cols-3 gap-3">
        <MoneyTile label="Deposits" value={formatCents(money.depositPaidCents)} sub={`of ${formatCents(money.depositCents)}`} />
        <MoneyTile label="Collected" value={formatCents(money.collectedCents)} sub="settled" />
        <MoneyTile label="Outstanding" value={formatCents(money.outstandingCents)} sub="remaining" />
      </div>

      {/* Client */}
      <Card padding="md" className="flex items-center gap-3">
        <Avatar name={clientName} src={clientQ.data?.avatar_url ?? undefined} size="md" />
        <div className="flex min-w-0 flex-col">
          <span className="font-semibold text-content-primary">{isArtist ? clientName : "You"}</span>
          <span className="truncate font-mono text-xs text-content-muted">
            {clientQ.data?.city ?? "Client"} · {sessions.length} session{sessions.length === 1 ? "" : "s"}
          </span>
        </div>
      </Card>

      {/* Intake + references (from originating request) */}
      {requestQ.data && (
        <DetailSection title="Intake">
          <Card padding="lg" className="flex flex-col gap-3">
            {requestQ.data.placement && <IntakeRow label="Placement" value={requestQ.data.placement} />}
            {requestQ.data.size_description && <IntakeRow label="Size" value={requestQ.data.size_description} />}
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
            <Button size="sm" variant="ghost" onClick={addSession} loading={createSession.isPending} leadingIcon={<Icon name="plus" size={15} />}>
              Add session
            </Button>
          ) : undefined
        }
      >
        <div className="flex flex-col gap-3">
          {sessions.length === 0 ? (
            <p className="text-sm text-content-muted">No sessions yet.</p>
          ) : (
            sessions.map((s) => (
              <SessionCard
                key={s.id}
                session={s}
                payments={payments}
                isArtist={isArtist}
                depositBusy={depositBusy === s.id}
                onRequestDeposit={() => onRequestDeposit(s)}
                onReschedule={() =>
                  setReschedule({ id: s.id, value: toLocalInput(s.scheduled_start) })
                }
                onMarkDeposit={() =>
                  updateSession.mutate({ id: s.id, patch: { deposit_paid: !s.deposit_paid } })
                }
                onComplete={() =>
                  updateSession.mutate({ id: s.id, patch: { status: "completed" } })
                }
                onCancel={() =>
                  updateSession.mutate({ id: s.id, patch: { status: "cancelled" } })
                }
              />
            ))
          )}
          {sessions.length > 0 && (
            <Link
              href={`/waivers/sign/${booking.id}`}
              className="flex items-center justify-between rounded-lg border border-border-subtle bg-surface-base px-3.5 py-3 text-sm transition-colors hover:border-border-strong"
            >
              <span className="flex items-center gap-2.5 text-content-primary">
                <Icon name="shield" size={16} />
                {isArtist
                  ? "Consent form — review or send for signing"
                  : "Sign your consent form"}
              </span>
              <Icon name="chevron-right" size={16} />
            </Link>
          )}
        </div>
      </DetailSection>

      {/* Healing — aftercare check-in timeline (3d/1w/3w), ratings, shared
          photos, and the artist's add-to-portfolio / touch-up actions. */}
      {sessions.some((s) => s.status === "completed") && (
        <>
          <Divider />
          <DetailSection title="Healing">
            <HealingSection
              bookingId={booking.id}
              isArtist={isArtist}
              artistProfileId={booking.artist_id}
              artistUserId={artistQ.data?.profile_id ?? ""}
              clientProfileId={booking.client_id}
              clientName={clientName}
            />
          </DetailSection>
        </>
      )}

      {/* Review — client leaves one on a healed booking; artist may respond */}
      {booking.status === "completed" && (
        <>
          <Divider />
          <DetailSection title="Review">
            {!isArtist &&
              (review ? (
                <Card padding="lg" className="flex flex-col gap-3">
                  <ReviewCard review={review} reviewerName="You" reviewerAvatarUrl={clientQ.data?.avatar_url} />
                  {isReviewEditable(review) && (
                    <Button size="sm" variant="ghost" className="self-start" onClick={() => setReviewModalOpen(true)}>
                      Edit review
                    </Button>
                  )}
                </Card>
              ) : (
                <Card padding="lg" className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-semibold text-content-primary">How was your session?</span>
                    <span className="text-sm text-content-muted">Leave a rating and a few words for other clients.</span>
                  </div>
                  <Button size="sm" onClick={() => setReviewModalOpen(true)} leadingIcon={<Icon name="star" size={15} />}>
                    Leave a review
                  </Button>
                </Card>
              ))}
            {isArtist &&
              (review ? (
                <Card padding="lg" className="flex flex-col gap-3">
                  <ReviewCard review={review} reviewerName={clientName} reviewerAvatarUrl={clientQ.data?.avatar_url} />
                  <ArtistResponseForm
                    initialResponse={review.artist_response}
                    submitting={setResponse.isPending}
                    onSubmit={submitResponse}
                  />
                </Card>
              ) : (
                <p className="text-sm text-content-muted">{clientName} hasn&apos;t left a review yet.</p>
              ))}
          </DetailSection>
        </>
      )}

      {/* Booking-level actions (artist) */}
      {isArtist && isBookingCancellable(booking.status) && (
        <>
          <Divider />
          <DetailSection title="Booking status">
            <div className="flex flex-wrap gap-2">
              <StatusButton current={booking.status} target="confirmed" label="Mark scheduled" onClick={setStatus} id={booking.id} />
              <StatusButton current={booking.status} target="in_progress" label="Start work" onClick={setStatus} id={booking.id} />
              <StatusButton current={booking.status} target="completed" label="Mark healed" onClick={setStatus} id={booking.id} />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStatus.mutate({ id: booking.id, status: "cancelled" })}
                loading={setStatus.isPending}
              >
                Cancel booking
              </Button>
            </div>
          </DetailSection>
        </>
      )}

      {/* Reschedule modal */}
      <Modal
        open={reschedule != null}
        onClose={() => setReschedule(null)}
        title="Schedule session"
        description="Set the date and start time. The client is notified of the change."
        footer={
          <>
            <Button variant="ghost" onClick={() => setReschedule(null)}>Cancel</Button>
            <Button onClick={saveReschedule} loading={updateSession.isPending}>Save</Button>
          </>
        }
      >
        <FormField label="Date & time" htmlFor="rs-dt">
          <Input
            id="rs-dt"
            type="datetime-local"
            value={reschedule?.value ?? ""}
            onChange={(e) => setReschedule((r) => (r ? { ...r, value: e.target.value } : r))}
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
    </div>
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
    <Card padding="md" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-overlay font-mono text-sm text-content-accent">
          {session.session_number}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="font-semibold text-content-primary">
            {formatDateTime(session.scheduled_start)}
          </span>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <StatusBadge tone={sMeta.tone}>{sMeta.label}</StatusBadge>
            {session.deposit_cents > 0 && <StatusBadge tone={dMeta.tone}>{dMeta.label}</StatusBadge>}
          </div>
        </div>
        {session.deposit_cents > 0 && (
          <span className="font-mono text-sm text-content-secondary">
            {formatCents(session.deposit_cents)} dep
          </span>
        )}
      </div>

      {isArtist && !terminal && (
        <div className="flex flex-wrap gap-2 border-t border-border-subtle pt-3">
          <Button size="sm" variant="outline" onClick={onReschedule} leadingIcon={<Icon name="calendar" size={15} />}>
            {session.scheduled_start ? "Reschedule" : "Schedule"}
          </Button>
          {showDeposit && (
            <Button size="sm" variant="secondary" onClick={onRequestDeposit} loading={depositBusy} leadingIcon={<Icon name="credit-card" size={15} />}>
              Request deposit
            </Button>
          )}
          {session.deposit_cents > 0 && (
            <Button size="sm" variant="ghost" onClick={onMarkDeposit}>
              {session.deposit_paid ? "Unmark deposit" : "Mark deposit paid"}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onComplete}>Complete</Button>
          <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
        </div>
      )}

      {!isArtist && showDeposit && (
        <div className="flex items-center justify-between gap-3 border-t border-border-subtle pt-3">
          <span className="text-sm text-content-secondary">
            {depositState === "overdue" ? "Your deposit is overdue." : "A deposit holds your slot."}
          </span>
          <Button size="sm" onClick={onRequestDeposit} loading={depositBusy} leadingIcon={<Icon name="credit-card" size={15} />}>
            Pay deposit
          </Button>
        </div>
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
      onClick={() => onClick.mutate({ id, status: target })}
    >
      {label}
    </Button>
  );
}

function MoneyTile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Card padding="md" className="flex flex-col gap-0.5">
      <span className="font-mono text-[10px] uppercase tracking-widest text-content-muted">{label}</span>
      <span className="font-display text-xl font-bold tracking-tight">{value}</span>
      <span className="text-xs text-content-muted">{sub}</span>
    </Card>
  );
}

function IntakeRow({ label, value, tone }: { label: string; value: string; tone?: "warning" }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border-subtle pb-3 last:border-0 last:pb-0 sm:flex-row sm:gap-4">
      <span className="w-28 shrink-0 font-mono text-[11px] uppercase tracking-widest text-content-muted">{label}</span>
      <span className={"text-sm " + (tone === "warning" ? "text-warning-500" : "text-content-primary")}>{value}</span>
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/bookings" className="inline-flex w-fit items-center gap-1.5 text-sm text-content-secondary transition-colors hover:text-content-primary">
      <Icon name="chevron-left" size={16} /> Bookings
    </Link>
  );
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}
