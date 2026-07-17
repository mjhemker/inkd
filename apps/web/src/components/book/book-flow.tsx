"use client";

/**
 * Client booking-request flow for /book/[artistHandle].
 *
 * Five steps — service → details → references → dates → review — that build one
 * `booking_requests` row. Availability comes from the artist's rules + policy;
 * uploads honor the artist's upload-options policy; medical flags carry a
 * sensitive-info notice. Submitting requires a signed-in client.
 */
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCurrentProfile,
  usePublicArtist,
  usePublicServices,
  usePublicLocations,
  useBookableDates,
  useCreateBookingRequest,
  useUploadReference,
  useRemoveReference,
  newUploadBatchId,
  formatCents,
  type BookableDay,
  type PreferredDate,
  type ReferenceUpload,
  type Service,
} from "@inkd/core";
import {
  Avatar,
  Badge,
  BodyMap,
  Button,
  Card,
  Chip,
  Divider,
  Eyebrow,
  FormField,
  Icon,
  Input,
  Skeleton,
  Stepper,
  TextArea,
  Toggle,
  placementLabel,
  serializePlacement,
  useToast,
  type PlacementValue,
} from "@inkd/ui/web";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MAX_PREFERRED = 3;

type StepId = "service" | "details" | "references" | "dates" | "review";
const STEPS: { id: StepId; label: string }[] = [
  { id: "service", label: "Service" },
  { id: "details", label: "Details" },
  { id: "references", label: "References" },
  { id: "dates", label: "Dates" },
  { id: "review", label: "Review" },
];

const CUSTOM = "__custom__";

interface FormState {
  serviceId: string | null; // null when custom
  placementValue: PlacementValue | null; // structured body-map selection
  placement: string; // free-text specifics ("inner wrist, wrapping toward elbow")
  sizeDescription: string;
  description: string;
  budgetMin: string;
  budgetMax: string;
  isFirstTattoo: boolean;
  isCoverUp: boolean;
  hasMedical: boolean;
  medicalNotes: string;
  references: ReferenceUpload[];
  preferred: PreferredDate[];
}

const EMPTY: FormState = {
  serviceId: CUSTOM,
  placementValue: null,
  placement: "",
  sizeDescription: "",
  description: "",
  budgetMin: "",
  budgetMax: "",
  isFirstTattoo: false,
  isCoverUp: false,
  hasMedical: false,
  medicalNotes: "",
  references: [],
  preferred: [],
};

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTHS[(m ?? 1) - 1]?.slice(0, 3)} ${d}, ${y}`;
}
function toCents(v: string): number | null {
  const n = Number(v.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
}

export function BookFlow({ handle }: { handle: string }) {
  const artistQ = usePublicArtist(handle);

  if (artistQ.isLoading) return <BookScaffold><LoadingBody /></BookScaffold>;
  if (!artistQ.data) return <BookScaffold><NotFoundBody handle={handle} /></BookScaffold>;

  return <BookLoaded handle={handle} artist={artistQ.data} />;
}

function BookLoaded({
  handle,
  artist,
}: {
  handle: string;
  artist: NonNullable<ReturnType<typeof usePublicArtist>["data"]>;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const profileQ = useCurrentProfile();
  const servicesQ = usePublicServices(artist.artist.id);
  const locationsQ = usePublicLocations(artist.artist.id);
  const { days, policy } = useBookableDates(artist.artist.id);
  const createRequest = useCreateBookingRequest(profileQ.data?.id ?? "");
  const uploadRef = useUploadReference();
  const removeRef = useRemoveReference();

  const [stepIdx, setStepIdx] = useState(0);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const batchId = useRef(newUploadBatchId());
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [pendingKind, setPendingKind] = useState<"image" | "document">("image");

  const step = STEPS[stepIdx]!;
  const signedIn = Boolean(profileQ.data?.id);
  const booksClosed =
    policy?.booking_window === "closed" || !artist.artist.accepts_new_clients;

  const primaryLocation = locationsQ.data?.[0] ?? null;
  const allowImages = policy?.allow_image_uploads ?? true;
  const allowDocs = policy?.allow_document_uploads ?? true;

  function patch(next: Partial<FormState>) {
    setForm((f) => ({ ...f, ...next }));
  }

  const selectedService: Service | null = useMemo(
    () =>
      form.serviceId && form.serviceId !== CUSTOM
        ? servicesQ.data?.find((s) => s.id === form.serviceId) ?? null
        : null,
    [form.serviceId, servicesQ.data],
  );

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    if (!signedIn || !profileQ.data) {
      toast({ title: "Sign in to attach references", variant: "info" });
      return;
    }
    for (const file of Array.from(files)) {
      try {
        const meta = await uploadRef.mutateAsync({
          clientId: profileQ.data.id,
          batchId: batchId.current,
          file,
          filename: file.name,
          contentType: file.type || undefined,
          size: file.size,
        });
        patch({ references: [...formRef.current.references, meta] });
      } catch {
        toast({ title: `Couldn't upload ${file.name}`, variant: "danger" });
      }
    }
  }

  // keep a ref to latest form so the async upload loop appends correctly
  const formRef = useRef(form);
  formRef.current = form;

  async function dropReference(ref: ReferenceUpload) {
    patch({ references: form.references.filter((r) => r.path !== ref.path) });
    try {
      await removeRef.mutateAsync(ref.path);
    } catch {
      /* best-effort; the row is still gone from the request */
    }
  }

  function togglePreferred(day: BookableDay) {
    const exists = form.preferred.find((p) => p.date === day.date);
    if (exists) {
      patch({ preferred: form.preferred.filter((p) => p.date !== day.date) });
      return;
    }
    if (form.preferred.length >= MAX_PREFERRED) {
      toast({ title: `Pick up to ${MAX_PREFERRED} preferred days`, variant: "info" });
      return;
    }
    const w = day.windows[0];
    patch({
      preferred: [
        ...form.preferred,
        { date: day.date, start: w?.start, end: w?.end },
      ],
    });
  }

  async function submit() {
    if (!signedIn || !profileQ.data) {
      router.push(`/auth?next=${encodeURIComponent(`/book/${handle}`)}`);
      return;
    }
    setSubmitting(true);
    try {
      await createRequest.mutateAsync({
        artist_id: artist.artist.id,
        service_id: selectedService?.id ?? null,
        location_id: primaryLocation?.id ?? null,
        placement: form.placement || null,
        ...serializePlacement(form.placementValue),
        size_description: form.sizeDescription || null,
        description: form.description || null,
        reference_uploads: form.references as unknown as Record<string, unknown>[],
        budget_min_cents: toCents(form.budgetMin),
        budget_max_cents: toCents(form.budgetMax),
        is_first_tattoo: form.isFirstTattoo,
        is_cover_up: form.isCoverUp,
        has_medical_flags: form.hasMedical,
        medical_notes: form.hasMedical ? form.medicalNotes || null : null,
        preferred_dates: form.preferred as unknown as Record<string, unknown>[],
      });
      toast({
        title: "Request sent",
        description: `${artist.profile.display_name ?? "The artist"} will review and get back to you.`,
        variant: "success",
      });
      router.push("/bookings");
    } catch (err) {
      toast({
        title: "Couldn't send your request",
        description: err instanceof Error ? err.message : undefined,
        variant: "danger",
      });
      setSubmitting(false);
    }
  }

  const canNext =
    step.id === "service"
      ? form.serviceId !== null
      : step.id === "details"
        ? form.description.trim().length > 0 || form.placementValue !== null
        : true;

  return (
    <BookScaffold>
      <input
        ref={fileInput}
        type="file"
        multiple
        accept={pendingKind === "image" ? "image/*" : undefined}
        className="hidden"
        onChange={(e) => {
          void handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {/* Artist identity */}
      <ArtistHero artist={artist} location={primaryLocation} />

      {booksClosed ? (
        <Card padding="lg" className="mt-8 flex flex-col items-center gap-3 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-surface-overlay text-content-muted">
            <Icon name="clock" size={22} />
          </span>
          <h2 className="font-display text-xl font-bold tracking-tight">
            Books are closed right now
          </h2>
          <p className="max-w-sm text-content-secondary">
            {artist.profile.display_name ?? "This artist"} isn&apos;t taking new
            requests at the moment. Follow along and check back soon.
          </p>
          <Link
            href={`/`}
            className="text-sm text-content-accent transition-colors hover:text-content-primary"
          >
            Back to INKD
          </Link>
        </Card>
      ) : (
        <>
          <div className="mt-8">
            <Stepper current={stepIdx} steps={STEPS.map((s) => ({ label: s.label }))} />
          </div>

          {!signedIn && (
            <div className="mt-6 flex flex-wrap items-center gap-3 rounded-sm border border-border-accent bg-surface-plate-ink px-4 py-3">
              <Icon name="user" size={16} className="text-content-accent" />
              <p className="flex-1 text-sm text-content-secondary">
                You can build your request now — you&apos;ll sign in to attach
                references and send it.
              </p>
              <Link
                href={`/auth?next=${encodeURIComponent(`/book/${handle}`)}`}
                className="text-sm font-semibold text-content-accent hover:text-content-primary"
              >
                Sign in
              </Link>
            </div>
          )}

          <div className="mt-6">
            {step.id === "service" && (
              <StepService
                services={servicesQ.data ?? []}
                loading={servicesQ.isLoading}
                value={form.serviceId}
                onChange={(id) => patch({ serviceId: id })}
              />
            )}
            {step.id === "details" && (
              <StepDetails form={form} patch={patch} service={selectedService} />
            )}
            {step.id === "references" && (
              <StepReferences
                form={form}
                patch={patch}
                allowImages={allowImages}
                allowDocs={allowDocs}
                requireMedical={policy?.require_medical_disclosure ?? false}
                signedIn={signedIn}
                uploading={uploadRef.isPending}
                onPick={(kind) => {
                  setPendingKind(kind);
                  fileInput.current?.click();
                }}
                onDrop={dropReference}
              />
            )}
            {step.id === "dates" && (
              <StepDates
                days={days}
                selected={form.preferred}
                onToggle={togglePreferred}
                window={policy?.booking_window ?? null}
              />
            )}
            {step.id === "review" && (
              <StepReview
                form={form}
                service={selectedService}
                location={primaryLocation}
              />
            )}
          </div>

          <div className="mt-8 flex items-center justify-between gap-3">
            <Button
              variant="ghost"
              onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
              disabled={stepIdx === 0}
              leadingIcon={<Icon name="chevron-left" size={16} />}
            >
              Back
            </Button>
            {stepIdx < STEPS.length - 1 ? (
              <Button
                onClick={() => setStepIdx((i) => Math.min(STEPS.length - 1, i + 1))}
                disabled={!canNext}
                trailingIcon={<Icon name="chevron-right" size={16} />}
              >
                Continue
              </Button>
            ) : (
              <Button onClick={submit} loading={submitting} leadingIcon={<Icon name="check" size={16} />}>
                {signedIn ? "Send request" : "Sign in & send"}
              </Button>
            )}
          </div>
        </>
      )}
    </BookScaffold>
  );
}

// --- Steps ------------------------------------------------------------------
function StepService({
  services,
  loading,
  value,
  onChange,
}: {
  services: Service[];
  loading: boolean;
  value: string | null;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <StepHeading
        eyebrow="Step 1"
        title="What are you booking?"
        subtitle="Pick a service, or start a custom project and describe it in the next step."
      />
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {services.map((s) => (
            <ServiceCard
              key={s.id}
              selected={value === s.id}
              onClick={() => onChange(s.id)}
              title={s.name}
              meta={serviceMeta(s)}
              description={s.description}
            />
          ))}
          <ServiceCard
            selected={value === CUSTOM}
            onClick={() => onChange(CUSTOM)}
            title="Custom project"
            meta="Tell the artist what you have in mind"
            description="For a bespoke piece that doesn't fit a set service."
            icon="sparkles"
          />
        </div>
      )}
    </div>
  );
}

function serviceMeta(s: Service): string {
  const bits: string[] = [];
  if (s.duration_minutes) {
    const h = Math.floor(s.duration_minutes / 60);
    const m = s.duration_minutes % 60;
    bits.push(h ? `${h}h${m ? ` ${m}m` : ""}` : `${m}m`);
  }
  if (s.price_type === "quote") bits.push("Quote");
  else if (s.price_cents != null) {
    bits.push(
      (s.price_type === "starting_at" ? "From " : "") +
        formatCents(s.price_cents) +
        (s.price_type === "hourly" ? "/hr" : ""),
    );
  }
  return bits.join(" · ") || "Custom pricing";
}

function ServiceCard({
  selected,
  onClick,
  title,
  meta,
  description,
  icon,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  meta: string;
  description?: string | null;
  icon?: "sparkles";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={
        "group flex flex-col gap-1.5 rounded-sm border p-4 text-left outline-none transition-all focus-visible:ring-2 focus-visible:ring-brand " +
        (selected
          ? "border-brand bg-surface-plate-ink shadow-plate"
          : "border-border-subtle bg-surface-raised hover:border-border-strong")
      }
    >
      <div className="flex items-center justify-between">
        <span className="font-display text-base font-bold tracking-tight text-content-primary">
          {title}
        </span>
        {icon ? (
          <Icon name="sparkles" size={16} className="text-content-accent" />
        ) : (
          <span
            aria-hidden
            className={
              "grid h-5 w-5 place-items-center rounded-full border transition-colors " +
              (selected ? "border-brand bg-brand text-brand-on" : "border-border")
            }
          >
            {selected && <Icon name="check" size={12} />}
          </span>
        )}
      </div>
      <span className="font-mono text-[11px] uppercase tracking-widest text-content-muted">
        {meta}
      </span>
      {description && (
        <span className="text-sm text-content-secondary">{description}</span>
      )}
    </button>
  );
}

function StepDetails({
  form,
  patch,
  service,
}: {
  form: FormState;
  patch: (n: Partial<FormState>) => void;
  service: Service | null;
}) {
  return (
    <div className="flex flex-col gap-5">
      <StepHeading
        eyebrow="Step 2"
        title="The piece"
        subtitle={
          service
            ? `Booking ${service.name}. Give the artist the shape of it.`
            : "Describe the tattoo you want — the more detail, the better the quote."
        }
      />
      <FormField
        label="Placement"
        description="Tap where the piece goes — front or back, left or right."
      >
        <div className="rounded-xl border border-border-subtle bg-surface-raised/50 p-4">
          <BodyMap
            value={form.placementValue}
            onChange={(v) => patch({ placementValue: v })}
          />
        </div>
      </FormField>
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          label="Placement details"
          htmlFor="bk-placement"
          description="Optional — the specifics."
        >
          <Input
            id="bk-placement"
            value={form.placement}
            onChange={(e) => patch({ placement: e.target.value })}
            placeholder="Inner wrist, wrapping toward the elbow"
            leadingIcon={<Icon name="map-pin" size={16} />}
          />
        </FormField>
        <FormField label="Approx. size" htmlFor="bk-size" reserveDescriptionSpace>
          <Input
            id="bk-size"
            value={form.sizeDescription}
            onChange={(e) => patch({ sizeDescription: e.target.value })}
            placeholder='6" tall, palm-sized'
          />
        </FormField>
      </div>
      <FormField
        label="Describe your idea"
        htmlFor="bk-desc"
        description="Subject, style, linework vs. color, any must-haves."
      >
        <TextArea
          id="bk-desc"
          rows={4}
          value={form.description}
          onChange={(e) => patch({ description: e.target.value })}
          placeholder="A fine-line heron standing in reeds, mostly black with a touch of sage…"
        />
      </FormField>
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label="Budget — low" htmlFor="bk-bmin" description="Optional, helps scope the work.">
          <Input
            id="bk-bmin"
            inputMode="numeric"
            value={form.budgetMin}
            onChange={(e) => patch({ budgetMin: e.target.value })}
            placeholder="$300"
            leadingIcon={<Icon name="credit-card" size={16} />}
          />
        </FormField>
        <FormField label="Budget — high" htmlFor="bk-bmax">
          <Input
            id="bk-bmax"
            inputMode="numeric"
            value={form.budgetMax}
            onChange={(e) => patch({ budgetMax: e.target.value })}
            placeholder="$600"
            leadingIcon={<Icon name="credit-card" size={16} />}
          />
        </FormField>
      </div>
      <div className="flex flex-col gap-4 rounded-xl border border-border-subtle bg-surface-raised/50 p-4">
        <Toggle
          checked={form.isFirstTattoo}
          onCheckedChange={(v) => patch({ isFirstTattoo: v })}
          label="This is my first tattoo"
        />
        <Toggle
          checked={form.isCoverUp}
          onCheckedChange={(v) => patch({ isCoverUp: v })}
          label="This is a cover-up of existing work"
        />
      </div>
    </div>
  );
}

function StepReferences({
  form,
  patch,
  allowImages,
  allowDocs,
  requireMedical,
  signedIn,
  uploading,
  onPick,
  onDrop,
}: {
  form: FormState;
  patch: (n: Partial<FormState>) => void;
  allowImages: boolean;
  allowDocs: boolean;
  requireMedical: boolean;
  signedIn: boolean;
  uploading: boolean;
  onPick: (kind: "image" | "document") => void;
  onDrop: (ref: ReferenceUpload) => void;
}) {
  const images = form.references.filter((r) => r.kind === "image");
  const docs = form.references.filter((r) => r.kind === "document");
  return (
    <div className="flex flex-col gap-6">
      <StepHeading
        eyebrow="Step 3"
        title="References & health"
        subtitle="Add inspiration and anything the artist should know before you sit."
      />

      {!allowImages && !allowDocs ? (
        <Card padding="md" className="text-sm text-content-secondary">
          This artist collects references over chat after your request — nothing
          to upload here.
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-3">
            {allowImages && (
              <Button
                variant="secondary"
                onClick={() => onPick("image")}
                disabled={!signedIn}
                loading={uploading}
                leadingIcon={<Icon name="image" size={16} />}
              >
                Add reference images
              </Button>
            )}
            {allowDocs && (
              <Button
                variant="outline"
                onClick={() => onPick("document")}
                disabled={!signedIn}
                leadingIcon={<Icon name="plus" size={16} />}
              >
                Add a document
              </Button>
            )}
          </div>
          {!signedIn && (
            <p className="text-sm text-content-muted">Sign in to attach files.</p>
          )}
          {images.length > 0 && (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {images.map((r) => (
                <RefTile key={r.path} label={r.name} onRemove={() => onDrop(r)} />
              ))}
            </div>
          )}
          {docs.length > 0 && (
            <div className="flex flex-col gap-2">
              {docs.map((r) => (
                <div
                  key={r.path}
                  className="flex items-center gap-3 rounded-lg border border-border-subtle bg-surface-raised px-3 py-2"
                >
                  <Icon name="image" size={16} className="text-content-muted" />
                  <span className="flex-1 truncate text-sm text-content-secondary">
                    {r.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => onDrop(r)}
                    aria-label={`Remove ${r.name}`}
                    className="text-content-muted hover:text-content-primary"
                  >
                    <Icon name="x" size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Divider />

      <div className="flex flex-col gap-4">
        <Toggle
          checked={form.hasMedical}
          onCheckedChange={(v) => patch({ hasMedical: v })}
          label={
            requireMedical
              ? "I have medical conditions or allergies to disclose (required)"
              : "I have medical conditions or allergies to disclose"
          }
        />
        {form.hasMedical && (
          <>
            <div className="flex items-start gap-2.5 rounded-lg border border-info-500/30 bg-info-500/8 px-3 py-2.5">
              <Icon name="shield" size={16} className="mt-0.5 text-info-500" />
              <p className="text-sm text-content-secondary">
                This is sensitive health information. It&apos;s shared only with{" "}
                your artist to keep your session safe, stored under your account,
                and never shown publicly. Share only what you&apos;re comfortable
                with.
              </p>
            </div>
            <FormField label="What should your artist know?" htmlFor="bk-med">
              <TextArea
                id="bk-med"
                rows={3}
                value={form.medicalNotes}
                onChange={(e) => patch({ medicalNotes: e.target.value })}
                placeholder="Allergies, skin conditions, medications, fainting history…"
              />
            </FormField>
          </>
        )}
      </div>
    </div>
  );
}

function RefTile({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <div className="group relative aspect-square overflow-hidden rounded-lg border border-border-subtle bg-surface-overlay">
      <div className="grid h-full w-full place-items-center text-content-muted">
        <Icon name="image" size={22} />
      </div>
      <span className="absolute inset-x-0 bottom-0 truncate bg-surface-base/80 px-1.5 py-1 text-[10px] text-content-muted">
        {label}
      </span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label}`}
        className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-surface-base/80 text-content-secondary opacity-0 transition-opacity hover:text-content-primary group-hover:opacity-100"
      >
        <Icon name="x" size={13} />
      </button>
    </div>
  );
}

function StepDates({
  days,
  selected,
  onToggle,
  window,
}: {
  days: BookableDay[];
  selected: PreferredDate[];
  onToggle: (day: BookableDay) => void;
  window: string | null;
}) {
  const months = useMemo(() => {
    const map = new Map<string, BookableDay[]>();
    for (const d of days) {
      const key = d.date.slice(0, 7);
      map.set(key, [...(map.get(key) ?? []), d]);
    }
    return [...map.entries()];
  }, [days]);

  return (
    <div className="flex flex-col gap-5">
      <StepHeading
        eyebrow="Step 4"
        title="Preferred days"
        subtitle={`Pick up to ${MAX_PREFERRED} days that work — the artist confirms the exact time.`}
      />
      {window === "closed" || days.length === 0 ? (
        <Card padding="md" className="text-sm text-content-secondary">
          No open days are published in this booking window yet. You can still
          send your request and the artist will propose times.
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {months.map(([month, list]) => (
            <div key={month} className="flex flex-col gap-2.5">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-content-muted">
                {MONTHS[Number(month.slice(5, 7)) - 1]} {month.slice(0, 4)}
              </p>
              <div className="flex flex-wrap gap-2">
                {list.map((day) => {
                  const isSel = selected.some((p) => p.date === day.date);
                  return (
                    <button
                      key={day.date}
                      type="button"
                      onClick={() => onToggle(day)}
                      aria-pressed={isSel}
                      className={
                        "flex min-w-[4.5rem] flex-col items-center gap-0.5 rounded-lg border px-3 py-2 text-center outline-none transition-all focus-visible:ring-2 focus-visible:ring-brand " +
                        (isSel
                          ? "border-brand bg-surface-plate-ink text-content-primary"
                          : "border-border-subtle bg-surface-raised text-content-secondary hover:border-border-strong")
                      }
                    >
                      <span className="font-mono text-[10px] uppercase tracking-widest text-content-muted">
                        {WEEKDAYS[day.weekday]}
                      </span>
                      <span className="font-display text-lg font-bold leading-none">
                        {Number(day.date.slice(8, 10))}
                      </span>
                      <span className="text-[10px] text-content-muted">
                        {day.windows[0]?.start ?? ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {selected.map((p) => (
            <Badge key={p.date} variant="brand">
              {fmtDate(p.date)}
              {p.start ? ` · ${p.start}` : ""}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function StepReview({
  form,
  service,
  location,
}: {
  form: FormState;
  service: Service | null;
  location: { name: string | null; city: string | null } | null;
}) {
  return (
    <div className="flex flex-col gap-5">
      <StepHeading
        eyebrow="Step 5"
        title="Review & send"
        subtitle="One last look before it lands in the artist's inbox."
      />
      <Card padding="lg" className="flex flex-col gap-4">
        <ReviewRow label="Service" value={service?.name ?? "Custom project"} />
        {form.placementValue && (
          <ReviewRow
            label="Placement"
            value={placementLabel(form.placementValue, { withView: form.placementValue.view })}
          />
        )}
        {form.placement && <ReviewRow label="Placement details" value={form.placement} />}
        {form.sizeDescription && <ReviewRow label="Size" value={form.sizeDescription} />}
        {form.description && <ReviewRow label="Idea" value={form.description} />}
        {(form.budgetMin || form.budgetMax) && (
          <ReviewRow
            label="Budget"
            value={[form.budgetMin, form.budgetMax].filter(Boolean).join(" – ")}
          />
        )}
        <ReviewRow
          label="Flags"
          value={
            [
              form.isFirstTattoo ? "First tattoo" : null,
              form.isCoverUp ? "Cover-up" : null,
              form.hasMedical ? "Medical disclosure" : null,
            ]
              .filter(Boolean)
              .join(", ") || "None"
          }
        />
        <ReviewRow
          label="References"
          value={`${form.references.length} attached`}
        />
        <ReviewRow
          label="Preferred days"
          value={
            form.preferred.length
              ? form.preferred.map((p) => fmtDate(p.date)).join(", ")
              : "Flexible"
          }
        />
        {location && (
          <ReviewRow
            label="Studio"
            value={[location.name, location.city].filter(Boolean).join(" · ") || "—"}
          />
        )}
      </Card>
      <p className="text-sm text-content-muted">
        Sending a request doesn&apos;t book or charge you. The artist reviews it,
        may ask a question, then proposes times and any deposit.
      </p>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-border-subtle pb-3 last:border-0 last:pb-0 sm:flex-row sm:gap-4">
      <span className="w-32 shrink-0 font-mono text-[11px] uppercase tracking-widest text-content-muted">
        {label}
      </span>
      <span className="text-sm text-content-primary">{value}</span>
    </div>
  );
}

// --- Chrome + states --------------------------------------------------------
function BookScaffold({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-dvh bg-surface-base text-content-primary">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px]"
        style={{
          background:
            "radial-gradient(60% 60% at 50% 0%, rgba(124,58,237,0.16), transparent 70%)",
        }}
      />
      <header className="border-b border-border-subtle">
        <div className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-brand-on">
              <span className="font-display text-lg font-extrabold leading-none">I</span>
            </span>
            <span className="font-display text-xl font-bold tracking-tight">INKD</span>
          </Link>
          <Link
            href="/bookings"
            className="text-sm text-content-secondary transition-colors hover:text-content-primary"
          >
            My bookings
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-5 py-10 md:py-14">{children}</main>
    </div>
  );
}

function ArtistHero({
  artist,
  location,
}: {
  artist: NonNullable<ReturnType<typeof usePublicArtist>["data"]>;
  location: { name: string | null; city: string | null; state: string | null } | null;
}) {
  const name = artist.profile.display_name ?? artist.profile.handle ?? "Artist";
  return (
    <div className="flex flex-col gap-4">
      <Eyebrow>Request a booking</Eyebrow>
      <div className="flex items-start gap-4">
        <Avatar name={name} src={artist.profile.avatar_url ?? undefined} size="xl" />
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
            {name}
          </h1>
          {artist.artist.tagline && (
            <p className="text-content-secondary">{artist.artist.tagline}</p>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {location && (location.city || location.name) && (
              <Badge variant="outline">
                <Icon name="map-pin" size={12} />
                {[location.city, location.state].filter(Boolean).join(", ") ||
                  location.name}
              </Badge>
            )}
            {(artist.artist.styles ?? []).slice(0, 4).map((s) => (
              <Chip key={s}>{s}</Chip>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StepHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="font-display text-2xl font-bold tracking-tight">{title}</h2>
      <p className="text-content-secondary">{subtitle}</p>
    </div>
  );
}

function LoadingBody() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-16 w-16 rounded-full" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
      </div>
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

function NotFoundBody({ handle }: { handle: string }) {
  return (
    <Card padding="lg" className="flex flex-col items-center gap-3 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-xl bg-surface-overlay text-content-muted">
        <Icon name="search" size={22} />
      </span>
      <h1 className="font-display text-xl font-bold tracking-tight">
        No artist at @{handle}
      </h1>
      <p className="max-w-sm text-content-secondary">
        This booking link is broken or the artist isn&apos;t taking requests on
        INKD yet.
      </p>
      <Link href="/discover" className="text-sm text-content-accent hover:text-content-primary">
        Browse artists
      </Link>
    </Card>
  );
}
