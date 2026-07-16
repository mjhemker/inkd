/**
 * Client waiver signing flow (mobile). Route: /waivers/sign/[bookingId].
 *
 * Signature capture: typed full legal name only (signature_type: "typed").
 * The web flow adds a drawn HTML5-canvas signature per spec; on mobile we
 * deliberately skip a drawn pad rather than add react-native-svg +
 * PanResponder gesture plumbing for it. Justification: (1) ESIGN/UETA don't
 * require a drawn mark for a legally binding e-signature — a typed name with
 * explicit attestation language, checkbox acknowledgments, timestamp, and
 * device metadata is sufficient (see docs/waivers-DRAFT-for-review.md); (2) a
 * touch signature pad needs on-device testing to get right (pixel ratio,
 * gesture conflicts with the ScrollView) that this pass's verification
 * (tsc/lint, no device/simulator run) can't confirm; (3) it keeps this route
 * dependency-free. Revisit with react-native-svg if product wants parity.
 */
import { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import {
  Badge,
  Button,
  Checkbox,
  Icon,
  Input,
  Skeleton,
  ToastProvider,
} from "@inkd/ui/native";
import {
  useInkdClient,
  useCurrentProfile,
  useBookingWaiverContext,
  useSignWaiver,
} from "@inkd/core/hooks";
import {
  getProfileById,
  getArtistProfileById,
  listStudioLocations,
  getBookingRequest,
} from "@inkd/core/api";
import {
  renderWaiverBody,
  parseRequiredFields,
  retentionLabel,
  computeRetentionUntil,
  type WaiverRenderContext,
} from "@inkd/core/waivers";

function useSigningPlacementContext(
  artistId: string | undefined,
  requestId: string | null | undefined,
) {
  const client = useInkdClient();
  return useQuery({
    queryKey: ["waiverSigningPlacement", artistId ?? "", requestId ?? ""],
    queryFn: async () => {
      if (!artistId) return null;
      const artistProfile = await getArtistProfileById(client, artistId);
      if (!artistProfile) return null;
      const [profile, locations, request] = await Promise.all([
        getProfileById(client, artistProfile.profile_id),
        listStudioLocations(client, artistId),
        requestId ? getBookingRequest(client, requestId) : Promise.resolve(null),
      ]);
      const primary = locations.find((l) => l.is_primary) ?? locations[0];
      const addressParts = [primary?.address_line1, primary?.city, primary?.state]
        .filter(Boolean)
        .join(", ");
      return {
        artistName: profile?.display_name ?? "your artist",
        studioName: primary?.name ?? profile?.display_name ?? null,
        studioAddress: addressParts || null,
        procedureDescription: request?.description ?? null,
        placement: request?.placement ?? null,
      };
    },
    enabled: Boolean(artistId),
  });
}

export default function SignWaiverScreen() {
  return (
    <ToastProvider>
      <SignWaiverBody />
    </ToastProvider>
  );
}

function SignWaiverBody() {
  const router = useRouter();
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const { data: profile, isLoading: profileLoading } = useCurrentProfile();
  const {
    data: bookingContext,
    isLoading: contextLoading,
    isError: contextError,
  } = useBookingWaiverContext(bookingId);
  const placement = useSigningPlacementContext(
    bookingContext?.context.booking.artist_id,
    bookingContext?.context.booking.request_id,
  );
  const signWaiver = useSignWaiver();

  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [typedName, setTypedName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const template = bookingContext?.template ?? null;
  const state = bookingContext?.context.state ?? null;
  const requiredFields = useMemo(
    () => (template ? parseRequiredFields(template) : []),
    [template],
  );

  const renderCtx: WaiverRenderContext = {
    artistName: placement.data?.artistName ?? "your artist",
    studioName: placement.data?.studioName,
    studioAddress: placement.data?.studioAddress,
    clientName: profile?.display_name ?? profile?.email ?? null,
    procedureDescription:
      placement.data?.procedureDescription ??
      bookingContext?.context.booking.title ??
      null,
    placement: placement.data?.placement ?? null,
    sessionDate: null,
    date: new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
  };

  const renderedBody = template ? renderWaiverBody(template.body, renderCtx) : "";
  const allRequiredChecked = requiredFields
    .filter((f) => f.required)
    .every((f) => checks[f.key]);
  const canSubmit =
    allRequiredChecked && typedName.trim().length > 1 && !submitted;

  async function handleSubmit() {
    if (!template || !bookingContext || !profile || !state || !bookingId) return;
    setSubmitError(null);
    try {
      await signWaiver.mutateAsync({
        template_id: template.id,
        artist_id: bookingContext.context.booking.artist_id,
        client_id: profile.id,
        booking_id: bookingId,
        signer_name: typedName.trim(),
        signer_email: profile.email,
        state,
        signature_type: "typed",
        signature_data: typedName.trim(),
        content_snapshot: renderedBody,
        retention_until: computeRetentionUntil(state),
      });
      setSubmitted(true);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Couldn't submit your signature. Try again.",
      );
    }
  }

  if (profileLoading || contextLoading || placement.isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface-base" edges={["top", "bottom"]}>
        <View className="flex-1 gap-4 px-6 py-8">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-32 w-full" />
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView className="flex-1 bg-surface-base" edges={["top", "bottom"]}>
        <View className="flex-1 items-start gap-4 px-6 py-8">
          <Icon name="shield" size={28} color="#7C3AED" />
          <Text className="font-display text-2xl text-content-primary">
            Sign in to sign this waiver
          </Text>
          <Text className="text-sm text-content-secondary">
            This consent form is tied to your booking. Sign in with the same
            account you used to book, then come back to this link.
          </Text>
          <Button
            onPress={() =>
              router.push(`/auth?next=/waivers/sign/${bookingId}` as never)
            }
          >
            Sign in
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  if (contextError || !bookingContext) {
    return (
      <SafeAreaView className="flex-1 bg-surface-base" edges={["top", "bottom"]}>
        <View className="flex-1 px-6 py-8">
          <Text className="text-content-secondary">
            We couldn&apos;t find that booking. Double-check the link your
            artist sent you.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!template) {
    return (
      <SafeAreaView className="flex-1 bg-surface-base" edges={["top", "bottom"]}>
        <View className="flex-1 px-6 py-8">
          <Text className="text-content-secondary">
            Your artist hasn&apos;t set up a waiver template yet.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!state) {
    return (
      <SafeAreaView className="flex-1 bg-surface-base" edges={["top", "bottom"]}>
        <View className="flex-1 px-6 py-8">
          <Text className="text-content-secondary">
            We couldn&apos;t determine which state this session is in. Ask
            your artist to add a state to their studio location before you
            sign.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (submitted) {
    return (
      <SafeAreaView className="flex-1 bg-surface-base" edges={["top", "bottom"]}>
        <View className="flex-1 items-start gap-4 px-6 py-8">
          <View className="h-12 w-12 items-center justify-center rounded-2xl bg-success-500/15">
            <Icon name="check" size={24} color="#22C55E" />
          </View>
          <Text className="font-display text-2xl text-content-primary">
            Signed &amp; on file
          </Text>
          <Text className="text-sm text-content-secondary">
            Thanks, {typedName.trim()}. Your signed consent form has been
            recorded and can&apos;t be altered.
          </Text>
          <Button onPress={() => router.push("/(tabs)/bookings")}>
            Back to your bookings
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-base" edges={["top", "bottom"]}>
      <ScrollView className="flex-1" contentContainerClassName="gap-6 px-6 py-8">
        <View className="gap-2">
          <View className="flex-row items-center gap-2">
            <Text className="font-mono text-xs uppercase tracking-widest text-content-muted">
              Consent &amp; release
            </Text>
            <Badge variant="outline">{state}</Badge>
          </View>
          <Text className="font-display text-2xl text-content-primary">
            {template.title.replace(/\s*\(DRAFT[^)]*\)\s*/i, "")}
          </Text>
          <Text className="text-sm text-content-secondary">
            Read the full form below, check every required box, then sign
            with your typed legal name.
          </Text>
        </View>

        <View className="max-h-96 rounded-2xl border border-border-subtle bg-surface-raised p-4">
          <ScrollView>
            <Text className="text-xs leading-relaxed text-content-secondary">
              {renderedBody}
            </Text>
          </ScrollView>
        </View>

        <View className="gap-2 rounded-2xl border border-border-subtle bg-surface-raised p-4">
          <Text className="font-sans-medium text-sm text-content-primary">
            Acknowledgments
          </Text>
          {requiredFields.map((field) => (
            <Checkbox
              key={field.key}
              checked={Boolean(checks[field.key])}
              onCheckedChange={(value) =>
                setChecks((prev) => ({ ...prev, [field.key]: value }))
              }
              label={field.label}
              description={field.required ? undefined : "Optional"}
            />
          ))}
        </View>

        <View className="gap-3 rounded-2xl border border-border-subtle bg-surface-raised p-4">
          <Text className="font-sans-medium text-sm text-content-primary">
            Your signature
          </Text>
          <Text className="text-sm text-content-primary">
            Type your full legal name
          </Text>
          <Input
            value={typedName}
            onChangeText={setTypedName}
            placeholder="Jordan A. Client"
            autoComplete="name"
          />
          <Text className="text-xs text-content-muted">
            Retention: this record will be kept for {retentionLabel(state)}.
            Typing your name above and submitting counts as your legally
            binding electronic signature.
          </Text>
          {submitError && (
            <Text className="text-sm text-danger-500">{submitError}</Text>
          )}
          <Button
            size="lg"
            disabled={!canSubmit}
            loading={signWaiver.isPending}
            onPress={handleSubmit}
          >
            Submit signed waiver
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
