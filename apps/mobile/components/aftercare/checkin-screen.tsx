/**
 * Client-facing aftercare check-in (mobile). The client logs how their tattoo
 * is healing (a rating + optional note), can attach a private healed photo,
 * and — only via an explicit, default-OFF consent toggle — lets the artist
 * share that photo on their INKD portfolio. Submitting stamps the check-in
 * `responded` and notifies the artist (DB trigger). Mirrors
 * apps/web/src/components/aftercare/checkin-screen.tsx.
 */
import { useMemo, useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import {
  useCurrentProfile,
  useAftercareCheckinContext,
  useRespondToAftercareCheckin,
  uploadAftercarePhoto,
  useInkdClient,
  aftercareKindLabel,
  firstName,
  deriveShareState,
  type AftercareCheckin,
} from "@inkd/core";
import { Button, Card, Eyebrow, Icon, Spinner, TextArea, Toggle, useToast } from "@inkd/ui/native";

const RATINGS = [
  { value: 1, label: "Rough" },
  { value: 2, label: "Sore" },
  { value: 3, label: "Okay" },
  { value: 4, label: "Good" },
  { value: 5, label: "Great" },
];

export function AftercareCheckinScreen({ checkinId }: { checkinId: string }) {
  const { toast } = useToast();
  const client = useInkdClient();
  const { data: profile } = useCurrentProfile();
  const ctxQ = useAftercareCheckinContext(checkinId);
  const ctx = ctxQ.data ?? null;
  const checkin = ctx?.checkin ?? null;

  const respond = useRespondToAftercareCheckin(checkin);

  const [rating, setRating] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [uploading, setUploading] = useState(false);

  const artistName = ctx?.artistDisplayName ?? "your artist";
  const artistFirst = firstName(ctx?.artistDisplayName);
  const tattoo = ctx?.tattooLabel ?? "your new ink";

  const alreadyResponded = checkin?.status === "responded";

  if (ctxQ.isLoading) {
    return (
      <View className="min-h-[50vh] items-center justify-center">
        <Spinner size="large" />
      </View>
    );
  }
  if (!checkin) {
    return (
      <Card padding="lg">
        <Text className="text-content-secondary">
          This healing check-in isn&apos;t available. It may have expired or you don&apos;t have
          access.
        </Text>
      </Card>
    );
  }

  if (alreadyResponded) {
    return <RespondedSummary checkin={checkin} artistName={artistName} />;
  }

  async function onPickPhoto() {
    if (!profile) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      toast({
        title: "Photo access is off",
        description: "Enable it in Settings to upload a photo.",
        variant: "danger",
      });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
      allowsEditing: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset) return;

    setUploading(true);
    try {
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const filename = asset.fileName ?? `healed-${Date.now()}.jpg`;
      const contentType = asset.mimeType ?? "image/jpeg";
      const path = await uploadAftercarePhoto(client, {
        clientId: profile.id,
        checkinId,
        file: blob,
        filename,
        contentType,
      });
      setPhotoPath(path);
      setPhotoPreview(asset.uri);
    } catch (err) {
      toast({
        title: "Couldn't upload photo",
        description: err instanceof Error ? err.message : undefined,
        variant: "danger",
      });
    } finally {
      setUploading(false);
    }
  }

  function removePhoto() {
    setPhotoPath(null);
    setPhotoPreview(null);
    setConsent(false); // consent is meaningless without a photo
  }

  async function onSubmit() {
    if (rating == null) {
      toast({ title: "Pick how it's feeling first" });
      return;
    }
    try {
      await respond.mutateAsync({
        healing_rating: rating,
        note: note.trim() || null,
        photo_path: photoPath,
        consent_to_share: consent,
      });
      toast({ title: "Thanks — shared with your artist", variant: "success" });
    } catch (err) {
      toast({
        title: "Couldn't submit",
        description: err instanceof Error ? err.message : undefined,
        variant: "danger",
      });
    }
  }

  return (
    <View className="gap-6">
      <View className="gap-2">
        <Eyebrow>{`Healing check-in · ${aftercareKindLabel(checkin.kind)}`}</Eyebrow>
        <Text className="font-display text-2xl text-content-primary">
          How&apos;s {tattoo} healing?
        </Text>
        <Text className="text-content-secondary">
          A quick update helps {artistFirst} keep an eye on your healing.
        </Text>
      </View>

      {/* Rating */}
      <Card padding="lg" className="gap-4">
        <Text className="text-sm font-sans-semibold text-content-secondary">
          How&apos;s it feeling?
        </Text>
        <View className="flex-row gap-2">
          {RATINGS.map((r) => {
            const active = rating === r.value;
            return (
              <Pressable
                key={r.value}
                accessibilityRole="button"
                onPress={() => setRating(r.value)}
                className={
                  "flex-1 items-center gap-1 rounded-sm border px-2 py-3 " +
                  (active
                    ? "border-border-accent bg-surface-ember"
                    : "border-border-subtle bg-surface-raised")
                }
              >
                <Text
                  className={
                    "text-base font-sans-semibold " +
                    (active ? "text-brand-on-ember" : "text-content-primary")
                  }
                >
                  {r.value}
                </Text>
                <Text
                  className={
                    "text-xs " + (active ? "text-brand-on-ember" : "text-content-secondary")
                  }
                >
                  {r.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      {/* Note */}
      <Card padding="lg" className="gap-3">
        <Text className="text-sm font-sans-semibold text-content-secondary">
          Anything to add? <Text className="font-sans">(optional)</Text>
        </Text>
        <TextArea
          value={note}
          onChangeText={setNote}
          numberOfLines={3}
          placeholder="Peeling a little, no redness…"
          maxLength={2000}
        />
      </Card>

      {/* Photo + consent */}
      <Card padding="lg" className="gap-4">
        <View className="gap-1">
          <Text className="text-sm font-sans-semibold text-content-secondary">
            Add a healed photo
          </Text>
          <Text className="text-xs text-content-muted">
            Private by default — only you and {artistFirst} can see it unless you choose to share
            it below.
          </Text>
        </View>

        {photoPreview ? (
          <View className="overflow-hidden rounded-sm border border-border-subtle">
            <Image source={{ uri: photoPreview }} className="h-64 w-full" resizeMode="cover" />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Remove photo"
              onPress={removePhoto}
              className="absolute right-2 top-2 h-8 w-8 items-center justify-center rounded-full bg-black/60"
            >
              <Icon name="x" size={16} color="#FAFAFA" />
            </Pressable>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={onPickPhoto}
            disabled={uploading}
            className="flex-row items-center justify-center gap-2 rounded-sm border border-dashed border-border-subtle bg-surface-raised px-4 py-6"
          >
            {uploading ? (
              <Spinner size="small" />
            ) : (
              <Icon name="image" size={18} color="#D4D4D8" />
            )}
            <Text className="text-sm text-content-secondary">
              {uploading ? "Uploading…" : "Choose a photo"}
            </Text>
          </Pressable>
        )}

        <View
          className={
            "flex-row items-start justify-between gap-4 rounded-sm border border-border-subtle px-4 py-3 " +
            (photoPath ? "" : "opacity-60")
          }
        >
          <View className="flex-1 gap-0.5">
            <Text className="text-sm font-sans-medium text-content-primary">
              Let {artistName} share this healed photo on their INKD portfolio
            </Text>
            <Text className="text-xs text-content-muted">
              Off by default. You can add a photo without sharing it.
            </Text>
          </View>
          <Toggle checked={consent} onCheckedChange={setConsent} disabled={!photoPath} />
        </View>
      </Card>

      <Button
        onPress={() => void onSubmit()}
        disabled={respond.isPending || uploading}
        loading={respond.isPending}
        size="lg"
        leadingIcon={!respond.isPending ? <Icon name="check" size={18} color="#FAFAFA" /> : undefined}
      >
        Share my update
      </Button>
    </View>
  );
}

function RespondedSummary({
  checkin,
  artistName,
}: {
  checkin: AftercareCheckin;
  artistName: string;
}) {
  const shareState = useMemo(() => deriveShareState(checkin), [checkin]);
  return (
    <View className="gap-5">
      <Card padding="lg" className="items-start gap-3">
        <View className="h-11 w-11 items-center justify-center rounded-xl bg-surface-ember">
          <Icon name="check" size={20} color="#0A0A0B" />
        </View>
        <Text className="font-display text-xl text-content-primary">Update shared</Text>
        <Text className="text-content-secondary">
          Thanks — {artistName} has your healing update
          {checkin.healing_rating ? ` (feeling: ${checkin.healing_rating}/5)` : ""}.
        </Text>
        {checkin.note && (
          <Text className="rounded-sm bg-surface-raised px-3 py-2 text-sm text-content-secondary">
            &ldquo;{checkin.note}&rdquo;
          </Text>
        )}
        {checkin.photo_path && (
          <Text className="text-xs text-content-muted">
            {shareState === "shared"
              ? "Your healed photo is featured on their portfolio."
              : checkin.consent_to_share
                ? "You shared a healed photo — thanks for letting them feature your healing!"
                : "You added a private healed photo (not shared)."}
          </Text>
        )}
      </Card>
    </View>
  );
}
