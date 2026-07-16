"use client";

/**
 * Artist-facing "Healing" view for a booking: the aftercare check-in timeline
 * (ratings over time, notes, shared healed photos) plus one-tap actions —
 * add a consented healed photo to the portfolio, or offer a touch-up/rebook.
 * Also shown (read-only) to the client so both sides see the same timeline.
 */
import { useState } from "react";
import Link from "next/link";
import {
  useBookingAftercare,
  useAftercarePhotoUrl,
  useShareHealedPhoto,
  aftercareKindLabel,
  deriveShareState,
  type AftercareCheckin,
} from "@inkd/core";
import { Badge, Button, Card, Divider, Icon, Input, Modal, Spinner, useToast } from "@inkd/ui/web";

export interface HealingSectionProps {
  bookingId: string;
  isArtist: boolean;
  /** `artist_profiles.id` — the portfolio piece owner. */
  artistProfileId: string;
  /** `profiles.id` (auth uid) — the media bucket prefix for the shared copy. */
  artistUserId: string;
  /** `profiles.id` of the client (for the one-tap touch-up thread). */
  clientProfileId: string;
  clientName: string;
}

export function HealingSection(props: HealingSectionProps) {
  const { data, isLoading } = useBookingAftercare(props.bookingId);
  const checkins = data ?? [];

  if (isLoading) {
    return (
      <Card padding="lg">
        <Spinner size={20} />
      </Card>
    );
  }
  if (checkins.length === 0) {
    return (
      <Card padding="lg" className="flex items-center gap-3 text-content-secondary">
        <Icon name="clock" size={18} />
        <p className="text-sm">
          Healing check-ins (3 days, 1 week, 3 weeks) are scheduled automatically once a session is
          marked complete.
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {checkins.map((c) => (
        <HealingCheckinCard key={c.id} checkin={c} {...props} />
      ))}
    </div>
  );
}

function ratingLabel(r: number | null): string {
  if (r == null) return "—";
  return ["", "Rough", "Sore", "Okay", "Good", "Great"][r] ?? `${r}/5`;
}

function HealingCheckinCard({
  checkin,
  isArtist,
  artistProfileId,
  artistUserId,
  clientProfileId,
  clientName,
}: { checkin: AftercareCheckin } & HealingSectionProps) {
  const { toast } = useToast();
  const shareState = deriveShareState(checkin);
  const photoQ = useAftercarePhotoUrl(checkin.photo_path);
  const share = useShareHealedPhoto(checkin);
  const [shareOpen, setShareOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [placement, setPlacement] = useState("");

  const responded = checkin.status === "responded";

  async function confirmShare() {
    try {
      await share.mutateAsync({
        artistProfileId,
        artistUserId,
        meta: { title: title.trim() || null, placement: placement.trim() || null },
      });
      toast({ title: "Added to your portfolio", variant: "success" });
      setShareOpen(false);
    } catch (err) {
      toast({
        title: "Couldn't add to portfolio",
        description: err instanceof Error ? err.message : undefined,
        variant: "danger",
      });
    }
  }

  return (
    <Card padding="lg" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{aftercareKindLabel(checkin.kind)} check-in</span>
          <StatusPill checkin={checkin} />
        </div>
        <span className="text-xs text-content-tertiary">
          {new Date(checkin.scheduled_for).toLocaleDateString()}
        </span>
      </div>

      {responded ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
            <span className="text-content-secondary">
              Feeling: <span className="font-medium text-content-primary">{ratingLabel(checkin.healing_rating)}</span>
              {checkin.healing_rating ? ` (${checkin.healing_rating}/5)` : ""}
            </span>
          </div>
          {checkin.note && (
            <p className="rounded-sm bg-surface-raised px-3 py-2 text-sm text-content-secondary">
              “{checkin.note}”
            </p>
          )}

          {checkin.photo_path && (
            <div className="flex flex-col gap-2">
              {photoQ.data ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoQ.data}
                  alt="Healed tattoo"
                  className="max-h-64 w-full rounded-sm border border-border-subtle object-cover"
                />
              ) : (
                <div className="grid h-32 place-items-center rounded-sm bg-surface-raised">
                  <Spinner size={18} />
                </div>
              )}

              {isArtist && (
                <div className="flex flex-wrap items-center gap-2">
                  {shareState === "share_ready" && (
                    <Button size="sm" onClick={() => setShareOpen(true)}>
                      <Icon name="image" size={15} />
                      Add to portfolio
                    </Button>
                  )}
                  {shareState === "shared" && (
                    <Badge variant="success">
                      <Icon name="check" size={13} /> On your portfolio
                    </Badge>
                  )}
                  {shareState === "photo_private" && (
                    <span className="text-xs text-content-tertiary">
                      Client kept this photo private (not shareable).
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {isArtist && checkin.kind === "week_3" && (
            <div className="flex items-center gap-2">
              <Link href={`/messages/new?to=${clientProfileId}`}>
                <Button size="sm" variant="secondary">
                  <Icon name="message-circle" size={15} />
                  Request touch-up
                </Button>
              </Link>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-content-tertiary">
          {checkin.status === "skipped"
            ? "Skipped."
            : checkin.status === "sent"
              ? `Sent to ${clientName} — awaiting their reply.`
              : "Scheduled — not sent yet."}
        </p>
      )}

      <Modal open={shareOpen} onClose={() => setShareOpen(false)} title="Add healed photo to portfolio">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-content-secondary">
            {clientName} consented to share this healed photo. It&apos;ll be added to your public
            portfolio (attributed, marked healed) and auto-tagged.
          </p>
          {photoQ.data && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoQ.data}
              alt="Healed tattoo"
              className="max-h-56 w-full rounded-sm border border-border-subtle object-cover"
            />
          )}
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (optional)" />
          <Input
            value={placement}
            onChange={(e) => setPlacement(e.target.value)}
            placeholder="Placement, e.g. forearm (optional)"
          />
          <Divider />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShareOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmShare} disabled={share.isPending}>
              {share.isPending ? <Spinner size={16} /> : <Icon name="check" size={15} />}
              Add to portfolio
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}

function StatusPill({ checkin }: { checkin: AftercareCheckin }) {
  const map: Record<string, { label: string; variant: "neutral" | "success" | "brand" }> = {
    pending: { label: "Scheduled", variant: "neutral" },
    sent: { label: "Sent", variant: "brand" },
    responded: { label: "Responded", variant: "success" },
    skipped: { label: "Skipped", variant: "neutral" },
  };
  const m = map[checkin.status] ?? map.pending!;
  return <Badge variant={m.variant}>{m.label}</Badge>;
}
