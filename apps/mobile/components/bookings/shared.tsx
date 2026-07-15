/** Shared building blocks for the bookings surfaces (mobile). */
import { Image, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import {
  useInkdClient,
  getBookingReferenceUrls,
  type ReferenceUpload,
  type StatusTone,
} from "@inkd/core";
import { Badge, Icon, type BadgeVariant } from "@inkd/ui/native";

/** Our StatusTone tokens line up 1:1 with the design-system Badge variants. */
export function StatusBadge({
  tone,
  children,
}: {
  tone: StatusTone;
  children: React.ReactNode;
}) {
  return <Badge variant={tone as BadgeVariant}>{children}</Badge>;
}

export function formatDay(iso: string | null | undefined): string {
  if (!iso) return "Unscheduled";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "Time TBD";
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Reads `booking_requests.reference_uploads` jsonb into typed metadata. */
export function toRefs(value: unknown): ReferenceUpload[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (v): v is ReferenceUpload =>
      typeof v === "object" && v != null && "path" in v,
  );
}

/** Gallery of reference uploads — resolves short-lived signed URLs on mount. */
export function ReferencesGallery({ refs }: { refs: ReferenceUpload[] }) {
  const client = useInkdClient();
  const paths = refs.map((r) => r.path);
  const urlsQ = useQuery({
    queryKey: ["referenceUrls", paths],
    queryFn: () => getBookingReferenceUrls(client, paths),
    enabled: paths.length > 0,
  });

  if (refs.length === 0) {
    return <Text className="text-sm text-content-muted">No references attached.</Text>;
  }

  return (
    <View className="flex-row flex-wrap gap-3">
      {refs.map((r) => {
        const url = urlsQ.data?.[r.path];
        const isImage = r.kind === "image";
        return (
          <View
            key={r.path}
            className="h-24 w-24 overflow-hidden rounded-lg border border-border-subtle bg-surface-overlay"
          >
            {isImage && url ? (
              <Image source={{ uri: url }} className="h-full w-full" resizeMode="cover" />
            ) : (
              <View className="h-full w-full items-center justify-center gap-1.5 p-2">
                <Icon name="credit-card" size={20} color="#A1A1AA" />
                <Text
                  className="text-center text-[10px] text-content-muted"
                  numberOfLines={1}
                >
                  {r.name}
                </Text>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

/** A titled section wrapper used across the detail screens. */
export function DetailSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between gap-3">
        <Text className="font-mono text-[11px] uppercase tracking-[0.18em] text-content-muted">
          {title}
        </Text>
        {action}
      </View>
      {children}
    </View>
  );
}

/** Generic "not found" state for detail screens. */
export function NotFound({ title, body }: { title: string; body: string }) {
  return (
    <View className="gap-4 items-center rounded-xl border border-border-subtle bg-surface-raised p-6">
      <View className="h-12 w-12 items-center justify-center rounded-xl bg-surface-overlay">
        <Icon name="search" size={22} color="#71717A" />
      </View>
      <Text className="text-center font-display text-xl text-content-primary">{title}</Text>
      <Text className="text-center text-sm text-content-secondary">{body}</Text>
    </View>
  );
}

export function IntakeRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warning";
}) {
  return (
    <View className="gap-1">
      <Text className="font-mono text-[11px] uppercase tracking-widest text-content-muted">
        {label}
      </Text>
      <Text className={tone === "warning" ? "text-sm text-warning-500" : "text-sm text-content-primary"}>
        {value}
      </Text>
    </View>
  );
}
