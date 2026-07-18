/**
 * Artist request triage: full intake + references, then accept (→ booking +
 * session[s]), decline with a reason, or ask a question (→ messages thread).
 */
import { useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
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
  type PreferredDate,
} from "@inkd/core";
import {
  Avatar,
  Badge,
  BodyMapThumbnail,
  Button,
  Card,
  Chip,
  FormField,
  Icon,
  Input,
  Modal,
  Skeleton,
  TextArea,
  parsePlacement,
  placementLabelFromColumns,
  useToast,
} from "@inkd/ui/native";
import { DetailSection, IntakeRow, NotFound, ReferencesGallery, StatusBadge, formatDay, toRefs } from "./shared";
import { useTheme } from "@/providers/theme";

type Dialog = "accept" | "decline" | "ask" | null;
const SESSION_OPTIONS = ["1", "2", "3", "4", "5", "6"];

export function RequestDetail({ requestId }: { requestId: string }) {
  const { colors } = useTheme();
  const client = useInkdClient();
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
    ? (request.preferred_dates as unknown as PreferredDate[])
    : [];
  const clientName = clientQ.data?.display_name ?? clientQ.data?.handle ?? "Client";
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
      router.push("/(tabs)/bookings");
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
      router.push("/(tabs)/messages");
    } catch (err) {
      toast({
        title: "Couldn't send",
        description: err instanceof Error ? err.message : undefined,
        variant: "danger",
      });
    }
  }

  return (
    <View className="gap-6">
      <View className="gap-3">
        <Text className="font-mono text-xs uppercase tracking-widest text-content-muted">
          Booking request
        </Text>
        <View className="flex-row flex-wrap items-center gap-2">
          <Text className="font-display text-2xl text-content-primary">
            {placementText || request.placement || serviceQ.data?.name || "Custom project"}
          </Text>
          <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
          {request.has_medical_flags && (
            <Badge variant="danger">
              <View className="flex-row items-center gap-1">
                <Icon name="shield" size={11} color="#FAFAFA" />
                <Text className="font-sans-semibold text-xs text-neutral-50">Medical</Text>
              </View>
            </Badge>
          )}
        </View>
        <Text className="font-mono text-xs text-content-muted">
          Received {formatDay(request.created_at)}
        </Text>
      </View>

      {/* Client */}
      <Card padding="md" className="flex-row items-center gap-3">
        <Avatar name={clientName} src={clientQ.data?.avatar_url ?? undefined} size="md" />
        <View>
          <Text className="font-sans-semibold text-content-primary">{clientName}</Text>
          <Text className="font-mono text-xs text-content-muted">
            {request.is_first_tattoo ? "First tattoo" : "Returning collector"}
            {request.is_cover_up ? " · Cover-up" : ""}
          </Text>
        </View>
      </Card>

      {/* Intake */}
      <DetailSection title="Intake">
        <Card padding="lg" className="gap-4">
          <IntakeRow label="Service" value={serviceQ.data?.name ?? "Custom project"} />
          {placementValue && (
            <View className="flex-row items-center gap-3">
              <View className="rounded-lg border border-border-subtle bg-surface-raised/40 p-1">
                <BodyMapThumbnail value={placementValue} size={56} />
              </View>
              <View className="gap-0.5">
                <Text className="font-mono text-[11px] uppercase tracking-widest text-content-muted">
                  Placement
                </Text>
                <Text className="font-sans-semibold text-content-primary">{placementText}</Text>
                <Text className="font-mono text-[11px] uppercase tracking-widest text-content-muted">
                  {placementValue.view} view
                </Text>
              </View>
            </View>
          )}
          {request.placement && (
            <IntakeRow
              label={placementValue ? "Placement details" : "Placement"}
              value={request.placement}
            />
          )}
          {request.size_description && <IntakeRow label="Size" value={request.size_description} />}
          {request.description && <IntakeRow label="Idea" value={request.description} />}
          <IntakeRow
            label="Budget"
            value={formatBudget(request.budget_min_cents, request.budget_max_cents)}
          />
          {request.has_medical_flags && (
            <IntakeRow
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
          <View className="flex-row flex-wrap gap-2">
            {preferred.map((p) => (
              <Badge key={p.date} variant="outline">
                {p.date}
                {p.start ? ` · ${p.start}` : ""}
              </Badge>
            ))}
          </View>
        </DetailSection>
      )}

      {/* Actions */}
      {open ? (
        <View className="flex-row flex-wrap gap-2 rounded-xl border border-border-subtle bg-surface-raised p-3">
          <Button
            className="flex-1"
            onPress={() => {
              setTitle(request.placement || serviceQ.data?.name || "");
              setDialog("accept");
            }}
            leadingIcon={<Icon name="check" size={16} color="#FAFAFA" />}
          >
            Accept
          </Button>
          <Button
            variant="outline"
            onPress={() => setDialog("ask")}
            leadingIcon={<Icon name="message-circle" size={16} color={colors.text.primary} />}
          >
            Ask
          </Button>
          <Button variant="ghost" onPress={() => setDialog("decline")}>
            Decline
          </Button>
        </View>
      ) : (
        <Card padding="md">
          <Text className="text-sm text-content-secondary">
            This request is {meta.label.toLowerCase()} — no further action needed.
          </Text>
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
            <Button variant="ghost" onPress={() => setDialog(null)}>
              Cancel
            </Button>
            <Button onPress={onAccept} loading={accept.isPending}>
              Create booking
            </Button>
          </>
        }
      >
        <View className="gap-4">
          <FormField label="Project title">
            <Input value={title} onChangeText={setTitle} placeholder="Half-sleeve — heron" />
          </FormField>
          <FormField label="Deposit" description="On the first session.">
            <Input
              inputMode="numeric"
              value={deposit}
              onChangeText={setDeposit}
              placeholder="$150"
              leadingIcon={<Icon name="credit-card" size={16} color={colors.text.secondary} />}
            />
          </FormField>
          <FormField label="Sessions">
            <View className="flex-row flex-wrap gap-2">
              {SESSION_OPTIONS.map((n) => (
                <Chip key={n} selected={sessions === n} onPress={() => setSessions(n)}>
                  {n}
                </Chip>
              ))}
            </View>
          </FormField>
        </View>
      </Modal>

      {/* Decline dialog */}
      <Modal
        open={dialog === "decline"}
        onClose={() => setDialog(null)}
        title="Decline request"
        description="The client is notified. A short reason helps them adjust and re-request."
        footer={
          <>
            <Button variant="ghost" onPress={() => setDialog(null)}>
              Cancel
            </Button>
            <Button variant="danger" onPress={onDecline} loading={decline.isPending}>
              Decline
            </Button>
          </>
        }
      >
        <FormField label="Reason (optional)">
          <TextArea
            numberOfLines={3}
            value={reason}
            onChangeText={setReason}
            placeholder="Booked through spring — try me again in April, or reshape the size…"
          />
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
            <Button variant="ghost" onPress={() => setDialog(null)}>
              Cancel
            </Button>
            <Button onPress={onAsk} loading={ask.isPending}>
              Send
            </Button>
          </>
        }
      >
        <FormField label="Your question">
          <TextArea
            numberOfLines={3}
            value={question}
            onChangeText={setQuestion}
            placeholder="Can you share a photo of the placement, and are you flexible on size?"
          />
        </FormField>
      </Modal>
    </View>
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
