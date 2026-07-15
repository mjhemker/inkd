/**
 * Client booking-request flow for /book/[artistHandle] (mobile).
 *
 * Five steps — service → details → references & health → dates → review —
 * that build one `booking_requests` row. Mirrors apps/web/src/components/book/
 * book-flow.tsx, including native reference uploads (image + PDF picks,
 * honoring the artist's upload policy) via expo-image-picker / expo-document-picker.
 */
import { useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
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
  ToastProvider,
  useToast,
} from "@inkd/ui/native";

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
  serviceId: string | null;
  placement: string;
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
  const month = MONTHS[(m ?? 1) - 1]?.slice(0, 3) ?? "";
  return `${month} ${d}, ${y}`;
}
function toCents(v: string): number | null {
  const n = Number(v.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
}

export default function BookFlowScreen() {
  const { artistHandle } = useLocalSearchParams<{ artistHandle: string }>();
  return (
    <ToastProvider>
      <SafeAreaView className="flex-1 bg-surface-base" edges={["top", "bottom"]}>
        <ScrollView className="flex-1" contentContainerClassName="gap-6 px-6 py-8">
          {artistHandle ? <BookFlow handle={artistHandle} /> : (
            <Text className="text-content-secondary">No artist specified.</Text>
          )}
        </ScrollView>
      </SafeAreaView>
    </ToastProvider>
  );
}

function BookFlow({ handle }: { handle: string }) {
  const artistQ = usePublicArtist(handle);

  if (artistQ.isLoading) return <LoadingBody />;
  if (!artistQ.data) return <NotFoundBody handle={handle} />;

  return <BookLoaded artist={artistQ.data} />;
}

function BookLoaded({
  artist,
}: {
  artist: NonNullable<ReturnType<typeof usePublicArtist>["data"]>;
}) {
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
  const formRef = useRef(form);
  formRef.current = form;

  const step = STEPS[stepIdx]!;
  const signedIn = Boolean(profileQ.data?.id);
  const booksClosed = policy?.booking_window === "closed" || !artist.artist.accepts_new_clients;
  const primaryLocation = locationsQ.data?.[0] ?? null;
  const allowImages = policy?.allow_image_uploads ?? true;
  const allowDocs = policy?.allow_document_uploads ?? true;

  function patch(next: Partial<FormState>) {
    setForm((f) => ({ ...f, ...next }));
  }

  async function pickReferenceImages() {
    if (!signedIn || !profileQ.data) {
      toast({ title: "Sign in to attach references", variant: "info" });
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      toast({
        title: "Photo access is off",
        description: "Enable photo access in Settings to upload.",
        variant: "danger",
      });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
      allowsMultipleSelection: true,
    });
    if (result.canceled || result.assets.length === 0) return;
    for (const asset of result.assets) {
      try {
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        const meta = await uploadRef.mutateAsync({
          clientId: profileQ.data.id,
          batchId: batchId.current,
          file: blob,
          filename: asset.fileName ?? `photo-${Date.now()}.jpg`,
          contentType: asset.mimeType ?? "image/jpeg",
          size: asset.fileSize,
        });
        patch({ references: [...formRef.current.references, meta] });
      } catch {
        toast({ title: "Couldn't upload that image", variant: "danger" });
      }
    }
  }

  async function pickReferenceDocument() {
    if (!signedIn || !profileQ.data) {
      toast({ title: "Sign in to attach references", variant: "info" });
      return;
    }
    const result = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets) return;
    for (const asset of result.assets) {
      try {
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        const meta = await uploadRef.mutateAsync({
          clientId: profileQ.data.id,
          batchId: batchId.current,
          file: blob,
          filename: asset.name,
          contentType: asset.mimeType ?? "application/pdf",
          size: asset.size,
        });
        patch({ references: [...formRef.current.references, meta] });
      } catch {
        toast({ title: `Couldn't upload ${asset.name}`, variant: "danger" });
      }
    }
  }

  async function dropReference(ref: ReferenceUpload) {
    patch({ references: form.references.filter((r) => r.path !== ref.path) });
    try {
      await removeRef.mutateAsync(ref.path);
    } catch {
      /* best-effort; the row is still gone from the request */
    }
  }

  const selectedService: Service | null = useMemo(
    () =>
      form.serviceId && form.serviceId !== CUSTOM
        ? servicesQ.data?.find((s) => s.id === form.serviceId) ?? null
        : null,
    [form.serviceId, servicesQ.data],
  );

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
    patch({ preferred: [...form.preferred, { date: day.date, start: w?.start, end: w?.end }] });
  }

  async function submit() {
    if (!signedIn || !profileQ.data) return;
    setSubmitting(true);
    try {
      await createRequest.mutateAsync({
        artist_id: artist.artist.id,
        service_id: selectedService?.id ?? null,
        location_id: primaryLocation?.id ?? null,
        placement: form.placement || null,
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
      router.push("/(tabs)/bookings");
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
        ? form.description.trim().length > 0 || form.placement.trim().length > 0
        : true;

  return (
    <View className="gap-6">
      <ArtistHero artist={artist} location={primaryLocation} />

      {booksClosed ? (
        <Card padding="lg" className="items-center gap-3">
          <View className="h-12 w-12 items-center justify-center rounded-xl bg-surface-overlay">
            <Icon name="clock" size={22} color="#71717A" />
          </View>
          <Text className="font-display text-xl text-content-primary">Books are closed right now</Text>
          <Text className="text-center text-content-secondary">
            {artist.profile.display_name ?? "This artist"} isn&apos;t taking new requests at the
            moment. Follow along and check back soon.
          </Text>
        </Card>
      ) : (
        <>
          <Stepper current={stepIdx} steps={STEPS.map((s) => ({ label: s.label }))} />

          {!signedIn && (
            <View className="flex-row items-center gap-3 rounded-xl border border-border-subtle bg-surface-raised px-4 py-3">
              <Icon name="user" size={16} color="#A78BFA" />
              <Text className="flex-1 text-sm text-content-secondary">
                Sign in on the app to send your request — you can still build it now.
              </Text>
            </View>
          )}

          <View className="gap-6">
            {step.id === "service" && (
              <StepService
                services={servicesQ.data ?? []}
                loading={servicesQ.isLoading}
                value={form.serviceId}
                onChange={(id) => patch({ serviceId: id })}
              />
            )}
            {step.id === "details" && <StepDetails form={form} patch={patch} service={selectedService} />}
            {step.id === "references" && (
              <StepReferences
                form={form}
                patch={patch}
                allowImages={allowImages}
                allowDocs={allowDocs}
                requireMedical={policy?.require_medical_disclosure ?? false}
                signedIn={signedIn}
                uploading={uploadRef.isPending}
                onPickImages={() => void pickReferenceImages()}
                onPickDocument={() => void pickReferenceDocument()}
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
              <StepReview form={form} service={selectedService} location={primaryLocation} />
            )}
          </View>

          <View className="flex-row items-center justify-between gap-3">
            <Button
              variant="ghost"
              onPress={() => setStepIdx((i) => Math.max(0, i - 1))}
              disabled={stepIdx === 0}
              leadingIcon={<Icon name="chevron-left" size={16} color="#D4D4D8" />}
            >
              Back
            </Button>
            {stepIdx < STEPS.length - 1 ? (
              <Button onPress={() => setStepIdx((i) => Math.min(STEPS.length - 1, i + 1))} disabled={!canNext}>
                Continue
              </Button>
            ) : (
              <Button
                onPress={submit}
                loading={submitting}
                disabled={!signedIn}
                leadingIcon={<Icon name="check" size={16} color="#FAFAFA" />}
              >
                {signedIn ? "Send request" : "Sign in on the app to send"}
              </Button>
            )}
          </View>
        </>
      )}
    </View>
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
    <View className="gap-4">
      <StepHeading eyebrow="Step 1" title="What are you booking?" subtitle="Pick a service, or start a custom project and describe it next." />
      {loading ? (
        <View className="gap-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </View>
      ) : (
        <View className="gap-3">
          {services.map((s) => (
            <ServiceCard
              key={s.id}
              selected={value === s.id}
              onPress={() => onChange(s.id)}
              title={s.name}
              meta={serviceMeta(s)}
              description={s.description}
            />
          ))}
          <ServiceCard
            selected={value === CUSTOM}
            onPress={() => onChange(CUSTOM)}
            title="Custom project"
            meta="Tell the artist what you have in mind"
            description="For a bespoke piece that doesn't fit a set service."
            icon
          />
        </View>
      )}
    </View>
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
    bits.push((s.price_type === "starting_at" ? "From " : "") + formatCents(s.price_cents) + (s.price_type === "hourly" ? "/hr" : ""));
  }
  return bits.join(" · ") || "Custom pricing";
}

function ServiceCard({
  selected,
  onPress,
  title,
  meta,
  description,
  icon,
}: {
  selected: boolean;
  onPress: () => void;
  title: string;
  meta: string;
  description?: string | null;
  icon?: boolean;
}) {
  return (
    <Card
      onPress={onPress}
      padding="md"
      className={selected ? "gap-1.5 border-2 border-brand bg-surface-plate-ink" : "gap-1.5"}
    >
      <View className="flex-row items-center justify-between">
        <Text className="font-display text-base text-content-primary">{title}</Text>
        {icon ? (
          <Icon name="sparkles" size={16} color="#A78BFA" />
        ) : (
          <View
            className={
              selected
                ? "h-5 w-5 items-center justify-center rounded-full bg-brand"
                : "h-5 w-5 items-center justify-center rounded-full border border-border"
            }
          >
            {selected && <Icon name="check" size={12} color="#FAFAFA" />}
          </View>
        )}
      </View>
      <Text className="font-mono text-[11px] uppercase tracking-widest text-content-muted">{meta}</Text>
      {description ? <Text className="text-sm text-content-secondary">{description}</Text> : null}
    </Card>
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
    <View className="gap-5">
      <StepHeading
        eyebrow="Step 2"
        title="The piece"
        subtitle={
          service
            ? `Booking ${service.name}. Give the artist the shape of it.`
            : "Describe the tattoo you want — the more detail, the better the quote."
        }
      />
      <FormField label="Placement">
        <Input
          value={form.placement}
          onChangeText={(v) => patch({ placement: v })}
          placeholder="Left forearm, inner"
          leadingIcon={<Icon name="map-pin" size={16} color="#A1A1AA" />}
        />
      </FormField>
      <FormField label="Approx. size">
        <Input value={form.sizeDescription} onChangeText={(v) => patch({ sizeDescription: v })} placeholder='6" tall, palm-sized' />
      </FormField>
      <FormField label="Describe your idea" description="Subject, style, linework vs. color, any must-haves.">
        <TextArea
          numberOfLines={4}
          value={form.description}
          onChangeText={(v) => patch({ description: v })}
          placeholder="A fine-line heron standing in reeds, mostly black with a touch of sage…"
        />
      </FormField>
      <FormField label="Budget — low" description="Optional, helps scope the work.">
        <Input
          inputMode="numeric"
          value={form.budgetMin}
          onChangeText={(v) => patch({ budgetMin: v })}
          placeholder="$300"
          leadingIcon={<Icon name="credit-card" size={16} color="#A1A1AA" />}
        />
      </FormField>
      <FormField label="Budget — high">
        <Input
          inputMode="numeric"
          value={form.budgetMax}
          onChangeText={(v) => patch({ budgetMax: v })}
          placeholder="$600"
          leadingIcon={<Icon name="credit-card" size={16} color="#A1A1AA" />}
        />
      </FormField>
      <View className="gap-4 rounded-xl border border-border-subtle bg-surface-raised/50 p-4">
        <Toggle checked={form.isFirstTattoo} onCheckedChange={(v) => patch({ isFirstTattoo: v })} label="This is my first tattoo" />
        <Toggle checked={form.isCoverUp} onCheckedChange={(v) => patch({ isCoverUp: v })} label="This is a cover-up of existing work" />
      </View>
    </View>
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
  onPickImages,
  onPickDocument,
  onDrop,
}: {
  form: FormState;
  patch: (n: Partial<FormState>) => void;
  allowImages: boolean;
  allowDocs: boolean;
  requireMedical: boolean;
  signedIn: boolean;
  uploading: boolean;
  onPickImages: () => void;
  onPickDocument: () => void;
  onDrop: (ref: ReferenceUpload) => void;
}) {
  const images = form.references.filter((r) => r.kind === "image");
  const docs = form.references.filter((r) => r.kind === "document");
  return (
    <View className="gap-6">
      <StepHeading
        eyebrow="Step 3"
        title="References & health"
        subtitle="Add inspiration and anything the artist should know before you sit."
      />

      {!allowImages && !allowDocs ? (
        <Card padding="md">
          <Text className="text-sm text-content-secondary">
            This artist collects references over chat after your request — nothing to upload
            here.
          </Text>
        </Card>
      ) : (
        <View className="gap-4">
          <View className="flex-row flex-wrap gap-3">
            {allowImages && (
              <Button
                variant="secondary"
                onPress={onPickImages}
                disabled={!signedIn}
                loading={uploading}
                leadingIcon={<Icon name="image" size={16} color="#FAFAFA" />}
              >
                Add reference images
              </Button>
            )}
            {allowDocs && (
              <Button
                variant="outline"
                onPress={onPickDocument}
                disabled={!signedIn}
                leadingIcon={<Icon name="plus" size={16} color="#D4D4D8" />}
              >
                Add a PDF
              </Button>
            )}
          </View>
          {!signedIn && (
            <Text className="text-sm text-content-muted">Sign in to attach files.</Text>
          )}
          {images.length > 0 && (
            <View className="flex-row flex-wrap gap-2.5">
              {images.map((r) => (
                <RefImageTile key={r.path} item={r} onRemove={() => onDrop(r)} />
              ))}
            </View>
          )}
          {docs.length > 0 && (
            <View className="gap-2">
              {docs.map((r) => (
                <View
                  key={r.path}
                  className="flex-row items-center gap-3 rounded-lg border border-border-subtle bg-surface-raised px-3 py-2"
                >
                  <Icon name="image" size={16} color="#71717A" />
                  <Text className="flex-1 text-sm text-content-secondary" numberOfLines={1}>
                    {r.name}
                  </Text>
                  <Pressable
                    onPress={() => onDrop(r)}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${r.name}`}
                    hitSlop={6}
                  >
                    <Icon name="x" size={16} color="#71717A" />
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      <Divider />

      <View className="gap-4">
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
            <View className="flex-row items-start gap-2.5 rounded-lg border border-info-500/30 bg-info-500/10 px-3 py-2.5">
              <Icon name="shield" size={16} color="#38BDF8" />
              <Text className="flex-1 text-sm text-content-secondary">
                This is sensitive health information. It&apos;s shared only with your artist to keep
                your session safe, stored under your account, and never shown publicly. Share only
                what you&apos;re comfortable with.
              </Text>
            </View>
            <FormField label="What should your artist know?">
              <TextArea
                numberOfLines={3}
                value={form.medicalNotes}
                onChangeText={(v) => patch({ medicalNotes: v })}
                placeholder="Allergies, skin conditions, medications, fainting history…"
              />
            </FormField>
          </>
        )}
      </View>
    </View>
  );
}

/** Reference images live in the private booking-uploads bucket — rendered as a
 * filename chip (no live thumbnail) rather than fetching a signed URL per
 * tile, mirroring apps/web's RefTile. */
function RefImageTile({ item, onRemove }: { item: ReferenceUpload; onRemove: () => void }) {
  return (
    <View className="h-24 w-24 overflow-hidden rounded-xl border border-border-subtle bg-surface-overlay">
      <View className="h-full w-full items-center justify-center">
        <Icon name="image" size={22} color="#71717A" />
      </View>
      <View className="absolute inset-x-0 bottom-0 bg-surface-base/80 px-1.5 py-1">
        <Text className="text-[10px] text-content-muted" numberOfLines={1}>
          {item.name}
        </Text>
      </View>
      <Pressable
        onPress={onRemove}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${item.name}`}
        className="absolute right-1 top-1 h-6 w-6 items-center justify-center rounded-full bg-surface-base/80"
      >
        <Icon name="x" size={13} color="#A1A1AA" />
      </Pressable>
    </View>
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
    <View className="gap-5">
      <StepHeading
        eyebrow="Step 4"
        title="Preferred days"
        subtitle={`Pick up to ${MAX_PREFERRED} days that work — the artist confirms the exact time.`}
      />
      {window === "closed" || days.length === 0 ? (
        <Card padding="md">
          <Text className="text-sm text-content-secondary">
            No open days are published in this booking window yet. You can still send your request
            and the artist will propose times.
          </Text>
        </Card>
      ) : (
        <View className="gap-6">
          {months.map(([month, list]) => (
            <View key={month} className="gap-2.5">
              <Text className="font-mono text-[11px] uppercase tracking-[0.18em] text-content-muted">
                {MONTHS[Number(month.slice(5, 7)) - 1]} {month.slice(0, 4)}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {list.map((day) => {
                  const isSel = selected.some((p) => p.date === day.date);
                  return (
                    <Card
                      key={day.date}
                      onPress={() => onToggle(day)}
                      padding="sm"
                      className={
                        isSel
                          ? "min-w-[4.5rem] items-center gap-0.5 border-2 border-brand bg-surface-plate-ink"
                          : "min-w-[4.5rem] items-center gap-0.5"
                      }
                    >
                      <Text className="font-mono text-[10px] uppercase tracking-widest text-content-muted">
                        {WEEKDAYS[day.weekday]}
                      </Text>
                      <Text className="font-display text-lg leading-none text-content-primary">
                        {Number(day.date.slice(8, 10))}
                      </Text>
                      <Text className="text-[10px] text-content-muted">{day.windows[0]?.start ?? ""}</Text>
                    </Card>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      )}
      {selected.length > 0 && (
        <View className="flex-row flex-wrap gap-2 pt-1">
          {selected.map((p) => (
            <Badge key={p.date} variant="brand">
              {fmtDate(p.date)}
              {p.start ? ` · ${p.start}` : ""}
            </Badge>
          ))}
        </View>
      )}
    </View>
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
    <View className="gap-5">
      <StepHeading eyebrow="Step 5" title="Review & send" subtitle="One last look before it lands in the artist's inbox." />
      <Card padding="lg" className="gap-4">
        <ReviewRow label="Service" value={service?.name ?? "Custom project"} />
        {form.placement && <ReviewRow label="Placement" value={form.placement} />}
        {form.sizeDescription && <ReviewRow label="Size" value={form.sizeDescription} />}
        {form.description && <ReviewRow label="Idea" value={form.description} />}
        {(form.budgetMin || form.budgetMax) && (
          <ReviewRow label="Budget" value={[form.budgetMin, form.budgetMax].filter(Boolean).join(" – ")} />
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
        <ReviewRow label="References" value={`${form.references.length} attached`} />
        <ReviewRow
          label="Preferred days"
          value={form.preferred.length ? form.preferred.map((p) => fmtDate(p.date)).join(", ") : "Flexible"}
        />
        {location && (
          <ReviewRow label="Studio" value={[location.name, location.city].filter(Boolean).join(" · ") || "—"} />
        )}
      </Card>
      <Text className="text-sm text-content-muted">
        Sending a request doesn&apos;t book or charge you. The artist reviews it, may ask a question,
        then proposes times and any deposit.
      </Text>
    </View>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="gap-0.5">
      <Text className="font-mono text-[11px] uppercase tracking-widest text-content-muted">{label}</Text>
      <Text className="text-sm text-content-primary">{value}</Text>
    </View>
  );
}

// --- Chrome + states ---------------------------------------------------------
function ArtistHero({
  artist,
  location,
}: {
  artist: NonNullable<ReturnType<typeof usePublicArtist>["data"]>;
  location: { name: string | null; city: string | null; state: string | null } | null;
}) {
  const name = artist.profile.display_name ?? artist.profile.handle ?? "Artist";
  return (
    <View className="gap-4">
      <Eyebrow>Request a booking</Eyebrow>
      <View className="flex-row items-start gap-4">
        <Avatar name={name} src={artist.profile.avatar_url ?? undefined} size="xl" />
        <View className="flex-1 gap-1.5">
          <Text className="font-display text-3xl text-content-primary">{name}</Text>
          {artist.artist.tagline && <Text className="text-content-secondary">{artist.artist.tagline}</Text>}
          <View className="mt-1 flex-row flex-wrap items-center gap-2">
            {location && (location.city || location.name) && (
              <Badge variant="outline">
                {[location.city, location.state].filter(Boolean).join(", ") || location.name}
              </Badge>
            )}
            {(artist.artist.styles ?? []).slice(0, 4).map((s) => (
              <Chip key={s}>{s}</Chip>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

function StepHeading({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return (
    <View className="gap-1.5">
      <Eyebrow>{eyebrow}</Eyebrow>
      <Text className="font-display text-2xl text-content-primary">{title}</Text>
      <Text className="text-content-secondary">{subtitle}</Text>
    </View>
  );
}

function LoadingBody() {
  return (
    <View className="gap-6">
      <View className="flex-row items-center gap-4">
        <Skeleton className="h-16 w-16 rounded-full" />
        <View className="gap-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-56" />
        </View>
      </View>
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-40 w-full" />
    </View>
  );
}

function NotFoundBody({ handle }: { handle: string }) {
  return (
    <Card padding="lg" className="items-center gap-3">
      <View className="h-12 w-12 items-center justify-center rounded-xl bg-surface-overlay">
        <Icon name="search" size={22} color="#71717A" />
      </View>
      <Text className="font-display text-xl text-content-primary">No artist at @{handle}</Text>
      <Text className="text-center text-content-secondary">
        This booking link is broken or the artist isn&apos;t taking requests on INKD yet.
      </Text>
    </Card>
  );
}
