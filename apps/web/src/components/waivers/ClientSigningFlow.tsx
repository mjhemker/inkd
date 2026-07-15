"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Badge,
  Button,
  Checkbox,
  Eyebrow,
  Icon,
  Input,
  Skeleton,
} from "@inkd/ui/web";
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
import { SignaturePad, type SignaturePadHandle } from "./SignaturePad";

/** Loads the artist name / studio name+address and the original intake's
 * procedure description + placement, all of which feed template
 * placeholders. Small, page-local composition over existing api calls — not
 * promoted to a shared hook since it's only used here. */
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

export function ClientSigningFlow({ bookingId }: { bookingId: string }) {
  const router = useRouter();
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
  const signaturePadRef = useRef<SignaturePadHandle>(null);

  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [typedName, setTypedName] = useState("");
  const [hasSignature, setHasSignature] = useState(false);
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
    allRequiredChecked && typedName.trim().length > 1 && hasSignature && !submitted;

  async function handleSubmit() {
    if (!template || !bookingContext || !profile || !state) return;
    setSubmitError(null);
    const signatureData = signaturePadRef.current?.toDataUrl() ?? null;
    try {
      await signWaiver.mutateAsync({
        template_id: template.id,
        artist_id: bookingContext.context.booking.artist_id,
        client_id: profile.id,
        booking_id: bookingId,
        signer_name: typedName.trim(),
        signer_email: profile.email,
        state,
        signature_type: "drawn",
        signature_data: signatureData,
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
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-2xl border border-border-subtle bg-surface-raised p-8">
        <Icon name="shield" size={28} className="text-content-accent" />
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-2xl font-bold text-content-primary">
            Sign in to sign this waiver
          </h1>
          <p className="text-content-secondary">
            This consent form is tied to your booking. Sign in with the same
            account you used to book, then come back to this link.
          </p>
        </div>
        <Button
          onClick={() =>
            router.push(`/auth?next=/waivers/sign/${bookingId}`)
          }
        >
          Sign in
        </Button>
      </div>
    );
  }

  if (contextError || !bookingContext) {
    return (
      <div className="rounded-2xl border border-border-subtle bg-surface-raised p-8 text-content-secondary">
        We couldn&apos;t find that booking. Double-check the link your artist
        sent you, or ask them to resend it.
      </div>
    );
  }

  if (!template) {
    return (
      <div className="rounded-2xl border border-border-subtle bg-surface-raised p-8 text-content-secondary">
        Your artist hasn&apos;t set up a waiver template yet. Ask them to pick
        one under Settings &rsaquo; Waivers before you sign.
      </div>
    );
  }

  if (!state) {
    return (
      <div className="rounded-2xl border border-border-subtle bg-surface-raised p-8 text-content-secondary">
        We couldn&apos;t determine which state this session is in (your
        artist&apos;s studio location is missing a state). Ask them to add
        one in Settings before you sign — this form needs to know MD or PA to
        apply the right consent rules and retention period.
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-sm border border-border-subtle bg-surface-raised p-8">
        <span className="grid h-12 w-12 place-items-center rounded-sm bg-success-600 text-neutral-50">
          <Icon name="check" size={24} />
        </span>
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-2xl font-bold text-content-primary">
            Signed &amp; on file
          </h1>
          <p className="max-w-lg text-content-secondary">
            Thanks, {typedName.trim()}. Your signed consent form has been
            recorded and can&apos;t be altered. Your artist can see it under
            their signed waivers.
          </p>
        </div>
        <Button onClick={() => router.push("/bookings")}>
          Back to your bookings
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Eyebrow>Consent &amp; release</Eyebrow>
          <Badge variant="outline">{state}</Badge>
        </div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-content-primary sm:text-3xl">
          {template.title.replace(/\s*\(DRAFT[^)]*\)\s*/i, "")}
        </h1>
        <p className="text-content-secondary">
          Read the full form below, check every required box, then sign with
          your typed legal name and a drawn signature.
        </p>
      </header>

      <div className="max-h-[26rem] overflow-y-auto rounded-2xl border border-border-subtle bg-surface-raised p-6">
        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-content-secondary">
          {renderedBody}
        </pre>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-border-subtle bg-surface-raised p-6">
        <h2 className="font-sans text-sm font-semibold text-content-primary">
          Acknowledgments
        </h2>
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
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-border-subtle bg-surface-raised p-6">
        <h2 className="font-sans text-sm font-semibold text-content-primary">
          Your signature
        </h2>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="typed-name"
            className="text-sm font-medium text-content-primary"
          >
            Type your full legal name
          </label>
          <Input
            id="typed-name"
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            placeholder="Jordan A. Client"
            autoComplete="name"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-content-primary">
            Draw your signature
          </span>
          <SignaturePad ref={signaturePadRef} onChange={setHasSignature} />
        </div>
        <p className="text-xs text-content-muted">
          Retention: this record will be kept for {retentionLabel(state)}.
          Typing and drawing above counts as your legally binding electronic
          signature.
        </p>
        {submitError && (
          <p role="alert" className="text-sm text-danger-500">
            {submitError}
          </p>
        )}
        <Button
          size="lg"
          disabled={!canSubmit}
          loading={signWaiver.isPending}
          onClick={handleSubmit}
        >
          Submit signed waiver
        </Button>
      </div>
    </div>
  );
}
