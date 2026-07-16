"use client";

/**
 * Artist request triage: full intake + references, then accept (→ booking +
 * session[s]), decline with a reason, or ask a question (→ messages thread).
 */
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  useInkdClient,
  useCurrentProfile,
  useAcceptRequest,
  useDeclineRequest,
  useAskQuestion,
  getBookingRequest,
  getProfileById,
  getService,
  REQUEST_STATUS_META,
  isRequestOpen,
  formatBudget,
} from "@inkd/core";
import {
  Avatar,
  Badge,
  BodyMapThumbnail,
  Button,
  Card,
  Eyebrow,
  FormField,
  Icon,
  Input,
  Modal,
  Select,
  Skeleton,
  TextArea,
  parsePlacement,
  placementLabelFromColumns,
  useToast,
} from "@inkd/ui/web";
import {
  DetailSection,
  ReferencesGallery,
  StatusBadge,
  formatDay,
  toRefs,
} from "./shared";

type Dialog = "accept" | "decline" | "ask" | null;

export function RequestDetail({ requestId }: { requestId: string }) {
  const client = useInkdClient();
  const router = useRouter();
  const { toast } = useToast();
  const profileQ = useCurrentProfile();

  const requestQ = useQuery({
    queryKey: ["bookingRequest", requestId],
    queryFn: () => getBookingRequest(client, requestId),
  });
  const request = requestQ.data ?? null;

  const clientQ = useQuery({
    queryKey: ["profile", request?.client_id],
    queryFn: () => (request ? getProfileById(client, request.client_id) : null),
    enabled: Boolean(request?.client_id),
  });
  const serviceQ = useQuery({
    queryKey: ["service", request?.service_id],
    queryFn: () => (request?.service_id ? getService(client, request.service_id) : null),
    enabled: Boolean(request?.service_id),
  });

  const artistId = request?.artist_id ?? "";
  const artistProfileId = profileQ.data?.id ?? "";
  const accept = useAcceptRequest(artistId);
  const decline = useDeclineRequest(artistId);
  const ask = useAskQuestion(artistId);

  const [dialog, setDialog] = useState<Dialog>(null);
  const [title, setTitle] = useState("");
  const [deposit, setDeposit] = useState("");
  const [sessions, setSessions] = useState("1");
  const [reason, setReason] = useState("");
  const [question, setQuestion] = useState("");

  if (requestQ.isLoading) return <DetailSkeleton />;
  if (!request) {
    return (
      <NotFound
        title="Request not found"
        body="This request may have been withdrawn or you don't have access."
      />
    );
  }

  const meta = REQUEST_STATUS_META[request.status];
  const refs = toRefs(request.reference_uploads);
  const preferred = Array.isArray(request.preferred_dates)
    ? (request.preferred_dates as { date: string; start?: string }[])
    : [];
  const clientName =
    clientQ.data?.display_name ?? clientQ.data?.handle ?? "Client";
  const open = isRequestOpen(request.status);
  const placementValue = parsePlacement(request);
  const placementText = placementLabelFromColumns(request);

  async function onAccept() {
    if (!request) return;
    const depositCents = deposit ? Math.round(Number(deposit.replace(/[^0-9.]/g, "")) * 100) : 0;
    try {
      const res = await accept.mutateAsync({
        request,
        input: {
          title: title || placementText || request.placement || "Tattoo project",
          depositCents: depositCents || null,
          sessionCount: Math.max(1, Number(sessions) || 1),
        },
      });
      toast({ title: "Request accepted", description: "Booking created.", variant: "success" });
      router.push(`/bookings/${res.booking.id}`);
    } catch (err) {
      toast({
        title: "Couldn't accept",
        description: err instanceof Error ? err.message : undefined,
        variant: "danger",
      });
    }
  }

  async function onDecline() {
    if (!request) return;
    try {
      await decline.mutateAsync({ request, reason: reason || undefined, artistProfileId });
      toast({ title: "Request declined", variant: "info" });
      router.push("/bookings");
    } catch (err) {
      toast({
        title: "Couldn't decline",
        description: err instanceof Error ? err.message : undefined,
        variant: "danger",
      });
    }
  }

  async function onAsk() {
    if (!request || !question.trim()) return;
    try {
      await ask.mutateAsync({ request, question, artistProfileId });
      toast({ title: "Question sent", description: "Continue in Messages.", variant: "success" });
      router.push("/messages");
    } catch (err) {
      toast({
        title: "Couldn't send",
        description: err instanceof Error ? err.message : undefined,
        variant: "danger",
      });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <BackLink />

      <header className="flex flex-col gap-3">
        <Eyebrow>Booking request</Eyebrow>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            {placementText || request.placement || serviceQ.data?.name || "Custom project"}
          </h1>
          <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
          {request.has_medical_flags && (
            <Badge variant="warning">
              <Icon name="shield" size={11} /> Medical
            </Badge>
          )}
        </div>
        <span className="font-mono text-xs text-content-muted">
          Received {formatDay(request.created_at)}
        </span>
      </header>

      {/* Client */}
      <Card padding="md" className="flex items-center gap-3">
        <Avatar name={clientName} src={clientQ.data?.avatar_url ?? undefined} size="md" />
        <div className="flex flex-col">
          <span className="font-semibold text-content-primary">{clientName}</span>
          <span className="font-mono text-xs text-content-muted">
            {request.is_first_tattoo ? "First tattoo" : "Returning collector"}
            {request.is_cover_up ? " · Cover-up" : ""}
          </span>
        </div>
      </Card>

      {/* Intake */}
      <DetailSection title="Intake">
        <Card padding="lg" className="flex flex-col gap-4">
          <Field label="Service" value={serviceQ.data?.name ?? "Custom project"} />
          {placementValue && (
            <div className="flex items-start gap-4 border-b border-border-subtle pb-3">
              <span className="w-24 shrink-0 font-mono text-[11px] uppercase tracking-widest text-content-muted">
                Placement
              </span>
              <div className="flex flex-1 items-center gap-3">
                <div className="shrink-0 rounded-lg border border-border-subtle bg-surface-raised/40 p-1">
                  <BodyMapThumbnail value={placementValue} size={64} />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold text-content-primary">
                    {placementText}
                  </span>
                  <span className="font-mono text-[11px] uppercase tracking-widest text-content-muted">
                    {placementValue.view} view
                  </span>
                </div>
              </div>
            </div>
          )}
          {request.placement && (
            <Field label={placementValue ? "Placement details" : "Placement"} value={request.placement} />
          )}
          {request.size_description && <Field label="Size" value={request.size_description} />}
          {request.description && <Field label="Idea" value={request.description} />}
          <Field
            label="Budget"
            value={formatBudget(request.budget_min_cents, request.budget_max_cents)}
          />
          {request.has_medical_flags && (
            <Field
              label="Medical"
              value={request.medical_notes || "Client flagged a medical disclosure."}
              tone="warning"
            />
          )}
        </Card>
      </DetailSection>

      {/* References */}
      <DetailSection title="References">
        <ReferencesGallery refs={refs} />
      </DetailSection>

      {/* Preferred dates */}
      {preferred.length > 0 && (
        <DetailSection title="Preferred days">
          <div className="flex flex-wrap gap-2">
            {preferred.map((p) => (
              <Badge key={p.date} variant="outline">
                {p.date}
                {p.start ? ` · ${p.start}` : ""}
              </Badge>
            ))}
          </div>
        </DetailSection>
      )}

      {/* Actions */}
      {open ? (
        <div className="sticky bottom-4 z-10 flex flex-wrap gap-2 rounded-xl border border-border-subtle bg-surface-base/90 p-3 backdrop-blur">
          <Button
            className="flex-1"
            onClick={() => {
              setTitle(request.placement || serviceQ.data?.name || "");
              setDialog("accept");
            }}
            leadingIcon={<Icon name="check" size={16} />}
          >
            Accept
          </Button>
          <Button variant="outline" onClick={() => setDialog("ask")} leadingIcon={<Icon name="message-circle" size={16} />}>
            Ask a question
          </Button>
          <Button variant="ghost" onClick={() => setDialog("decline")}>
            Decline
          </Button>
        </div>
      ) : (
        <Card padding="md" className="text-sm text-content-secondary">
          This request is {meta.label.toLowerCase()} — no further action needed.
        </Card>
      )}

      {/* Accept dialog */}
      <Modal
        open={dialog === "accept"}
        onClose={() => setDialog(null)}
        title="Accept & create booking"
        description="This creates the booking and its first session. You can schedule and add sessions next."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>Cancel</Button>
            <Button onClick={onAccept} loading={accept.isPending}>Create booking</Button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          <FormField label="Project title" htmlFor="ac-title">
            <Input id="ac-title" size="lg" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Half-sleeve — heron" />
          </FormField>
          <FormField label="Deposit" htmlFor="ac-dep" description="On the first session.">
            <Input id="ac-dep" size="lg" inputMode="numeric" value={deposit} onChange={(e) => setDeposit(e.target.value)} placeholder="$150" leadingIcon={<Icon name="credit-card" size={18} />} />
          </FormField>
          <FormField label="Sessions" htmlFor="ac-sessions">
            <Select
              id="ac-sessions"
              size="lg"
              value={sessions}
              onChange={(e) => setSessions(e.target.value)}
              options={["1", "2", "3", "4", "5", "6"].map((n) => ({ label: n, value: n }))}
            />
          </FormField>
        </div>
      </Modal>

      {/* Decline dialog */}
      <Modal
        open={dialog === "decline"}
        onClose={() => setDialog(null)}
        title="Decline request"
        description="The client is notified. A short reason helps them adjust and re-request."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>Cancel</Button>
            <Button variant="danger" onClick={onDecline} loading={decline.isPending}>Decline</Button>
          </>
        }
      >
        <FormField label="Reason (optional)" htmlFor="dc-reason">
          <TextArea id="dc-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Booked through spring — try me again in April, or reshape the size…" />
        </FormField>
      </Modal>

      {/* Ask dialog */}
      <Modal
        open={dialog === "ask"}
        onClose={() => setDialog(null)}
        title="Ask a question"
        description="Opens a message thread with the client. The request moves to Reviewing."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>Cancel</Button>
            <Button onClick={onAsk} loading={ask.isPending}>Send</Button>
          </>
        }
      >
        <FormField label="Your question" htmlFor="qa-q">
          <TextArea id="qa-q" rows={3} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Can you share a photo of the placement, and are you flexible on size?" />
        </FormField>
      </Modal>
    </div>
  );
}

function Field({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warning";
}) {
  return (
    <div className="flex flex-col gap-1 border-b border-border-subtle pb-3 last:border-0 last:pb-0 sm:flex-row sm:gap-4">
      <span className="w-28 shrink-0 font-mono text-[11px] uppercase tracking-widest text-content-muted">
        {label}
      </span>
      <span className={"text-sm " + (tone === "warning" ? "text-warning-500" : "text-content-primary")}>
        {value}
      </span>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/bookings"
      className="inline-flex w-fit items-center gap-1.5 text-sm text-content-secondary transition-colors hover:text-content-primary"
    >
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

export function NotFound({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col gap-6">
      <BackLink />
      <Card padding="lg" className="flex flex-col items-center gap-3 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-xl bg-surface-overlay text-content-muted">
          <Icon name="search" size={22} />
        </span>
        <h1 className="font-display text-xl font-bold tracking-tight">{title}</h1>
        <p className="max-w-sm text-content-secondary">{body}</p>
      </Card>
    </div>
  );
}
