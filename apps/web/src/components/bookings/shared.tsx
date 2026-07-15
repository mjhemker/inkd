"use client";

/** Shared building blocks for the bookings surfaces (web). */
import { useQuery } from "@tanstack/react-query";
import {
  useInkdClient,
  getBookingReferenceUrls,
  type ReferenceUpload,
  type StatusTone,
} from "@inkd/core";
import { Badge, Icon, type BadgeVariant } from "@inkd/ui/web";

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
    return (
      <p className="text-sm text-content-muted">No references attached.</p>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
      {refs.map((r) => {
        const url = urlsQ.data?.[r.path];
        const isImage = r.kind === "image";
        return isImage && url ? (
          <a
            key={r.path}
            href={url}
            target="_blank"
            rel="noreferrer"
            className="group relative aspect-square overflow-hidden rounded-lg border border-border-subtle bg-surface-overlay outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={r.name}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
          </a>
        ) : (
          <a
            key={r.path}
            href={url ?? "#"}
            target="_blank"
            rel="noreferrer"
            className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-lg border border-border-subtle bg-surface-overlay p-2 text-center text-content-muted outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <Icon name={isImage ? "image" : "credit-card"} size={20} />
            <span className="truncate text-[10px]">{r.name}</span>
          </a>
        );
      })}
    </div>
  );
}

/** A titled section wrapper used across the detail pages. */
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
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-content-muted">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Reads `booking_requests.reference_uploads` jsonb into typed metadata. */
export function toRefs(value: unknown): ReferenceUpload[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (v): v is ReferenceUpload =>
      typeof v === "object" && v != null && "path" in v,
  );
}
