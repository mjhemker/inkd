/**
 * Artist-facing "Healing" view for a booking (mobile): the aftercare
 * check-in timeline (ratings over time, notes, shared healed photos) plus
 * one-tap actions — add a consented healed photo to the portfolio, or offer
 * a touch-up/rebook. Also shown (read-only) to the client so both sides see
 * the same timeline. Mirrors
 * apps/web/src/components/aftercare/healing-section.tsx.
 */
import { useState } from "react";
import { Image, Text, View } from "react-native";
import { router } from "expo-router";
import {
  useBookingAftercare,
  useAftercarePhotoUrl,
  useShareHealedPhoto,
  aftercareKindLabel,
  deriveShareState,
  type AftercareCheckin,
} from "@inkd/core";
import {
  Badge,
  Button,
  Card,
  Divider,
  FormField,
  Icon,
  Input,
  Modal,
  Spinner,
  useToast,
  type BadgeVariant,
} from "@inkd/ui/native";

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
        <Spinner size="small" />
      </Card>
    );
  }
  if (checkins.length === 0) {
    return (
      <Card padding="lg" className="flex-row items-center gap-3">
        <Icon name="clock" size={18} color="#D4D4D8" />
        <Text className="flex-1 text-sm text-content-secondary">
          Healing check-ins (3 days, 1 week, 3 weeks) are scheduled automatically once a session
          is marked complete.
        </Text>
      </Card>
    );
  }

  return (
    <View className="gap-3">
      {checkins.map((c) => (
        <HealingCheckinCard key={c.id} checkin={c} {...props} />
      ))}
    </View>
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
    <Card padding="lg" className="gap-3">
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-row items-center gap-2">
          <Text className="text-sm font-sans-semibold text-content-primary">
            {aftercareKindLabel(checkin.kind)} check-in
          </Text>
          <StatusPill checkin={checkin} />
        </View>
        <Text className="text-xs text-content-muted">
          {new Date(checkin.scheduled_for).toLocaleDateString()}
        </Text>
      </View>

      {responded ? (
        <View className="gap-3">
          <View className="flex-row flex-wrap items-center gap-x-6 gap-y-1">
            <Text className="text-sm text-content-secondary">
              Feeling:{" "}
              <Text className="font-sans-medium text-content-primary">
                {ratingLabel(checkin.healing_rating)}
              </Text>
              {checkin.healing_rating ? ` (${checkin.healing_rating}/5)` : ""}
            </Text>
          </View>
          {checkin.note && (
            <Text className="rounded-sm bg-surface-raised px-3 py-2 text-sm text-content-secondary">
              &ldquo;{checkin.note}&rdquo;
            </Text>
          )}

          {checkin.photo_path && (
            <View className="gap-2">
              {photoQ.data ? (
                <Image
                  source={{ uri: photoQ.data }}
                  className="h-56 w-full rounded-sm border border-border-subtle"
                  resizeMode="cover"
                />
              ) : (
                <View className="h-32 items-center justify-center rounded-sm bg-surface-raised">
                  <Spinner size="small" />
                </View>
              )}

              {isArtist && (
                <View className="flex-row flex-wrap items-center gap-2">
                  {shareState === "share_ready" && (
                    <Button
                      size="sm"
                      onPress={() => setShareOpen(true)}
                      leadingIcon={<Icon name="image" size={15} color="#FAFAFA" />}
                    >
                      Add to portfolio
                    </Button>
                  )}
                  {shareState === "shared" && (
                    <Badge variant="success">
                      <Icon name="check" size={13} color="#FAFAFA" /> On your portfolio
                    </Badge>
                  )}
                  {shareState === "photo_private" && (
                    <Text className="text-xs text-content-muted">
                      Client kept this photo private (not shareable).
                    </Text>
                  )}
                </View>
              )}
            </View>
          )}

          {isArtist && checkin.kind === "week_3" && (
            <View className="flex-row items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                onPress={() => router.push(`/messages/new?to=${clientProfileId}`)}
                leadingIcon={<Icon name="message-circle" size={15} color="#FAFAFA" />}
              >
                Request touch-up
              </Button>
            </View>
          )}
        </View>
      ) : (
        <Text className="text-sm text-content-muted">
          {checkin.status === "skipped"
            ? "Skipped."
            : checkin.status === "sent"
              ? `Sent to ${clientName} — awaiting their reply.`
              : "Scheduled — not sent yet."}
        </Text>
      )}

      <Modal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        title="Add healed photo to portfolio"
        footer={
          <>
            <Button variant="ghost" onPress={() => setShareOpen(false)}>
              Cancel
            </Button>
            <Button
              onPress={() => void confirmShare()}
              loading={share.isPending}
              leadingIcon={!share.isPending ? <Icon name="check" size={15} color="#FAFAFA" /> : undefined}
            >
              Add to portfolio
            </Button>
          </>
        }
      >
        <View className="gap-4">
          <Text className="text-sm text-content-secondary">
            {clientName} consented to share this healed photo. It&apos;ll be added to your public
            portfolio (attributed, marked healed) and auto-tagged.
          </Text>
          {photoQ.data && (
            <Image
              source={{ uri: photoQ.data }}
              className="h-48 w-full rounded-sm border border-border-subtle"
              resizeMode="cover"
            />
          )}
          <FormField label="Title">
            <Input value={title} onChangeText={setTitle} placeholder="Title (optional)" />
          </FormField>
          <FormField label="Placement">
            <Input
              value={placement}
              onChangeText={setPlacement}
              placeholder="Placement, e.g. forearm (optional)"
            />
          </FormField>
          <Divider />
        </View>
      </Modal>
    </Card>
  );
}

function StatusPill({ checkin }: { checkin: AftercareCheckin }) {
  const map: Record<string, { label: string; variant: BadgeVariant }> = {
    pending: { label: "Scheduled", variant: "neutral" },
    sent: { label: "Sent", variant: "brand" },
    responded: { label: "Responded", variant: "success" },
    skipped: { label: "Skipped", variant: "neutral" },
  };
  const m = map[checkin.status] ?? map.pending!;
  return <Badge variant={m.variant}>{m.label}</Badge>;
}
