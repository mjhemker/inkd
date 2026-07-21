import { useState } from "react";
import { Image, Text, View } from "react-native";
import { router } from "expo-router";
import {
  Badge,
  FormField,
  Icon,
  Input,
  TextArea,
  Toggle,
  ToastProvider,
  useToast,
} from "@inkd/ui/native";
import {
  useCurrentArtistProfile,
  useCurrentProfile,
  usePostMutations,
} from "@inkd/core";

import { ArtistOnly } from "@/components/ArtistOnly";
import { ImageUploadField } from "@/components/profile/ImageUploadField";
import { StepScaffold } from "@/components/create/StepScaffold";
import { StyleSuggestInput } from "@/components/create/StyleSuggestInput";
import { useStyleOptions } from "@/components/create/useStyleOptions";
import { flashPriceLabel } from "@/lib/format";
import { useTheme } from "@/providers/theme";

/**
 * Progressive, full-screen "New post" flow (replaces the old inline sheet).
 * One prompt per screen:
 *   1 Media → 2 Caption → 3 Flash & styles (flash toggle + price, placement,
 *   styles) → 4 Review & publish
 *
 * A post is feed content: caption-first, optionally a bookable flash design
 * with a price. Flash + price + any custom (non-taxonomy) style tags ride in
 * the post's `media[0]` jsonb (no schema change); taxonomy styles persist via
 * post_styles. See docs/content-model.md.
 */
export default function NewPostFlow() {
  return (
    <ArtistOnly requireOnboarding>
      <ToastProvider>
        <PostFlowInner />
      </ToastProvider>
    </ArtistOnly>
  );
}

const STEP_COUNT = 4;

function PostFlowInner() {
  const { colors } = useTheme();
  const { toast } = useToast();
  const { data: profile } = useCurrentProfile();
  const { data: artist } = useCurrentArtistProfile();
  const artistId = artist?.id ?? "";
  const userId = profile?.id ?? "";

  const mutations = usePostMutations(artistId);
  const { options } = useStyleOptions({ artistId, keyBy: "id" });

  const [step, setStep] = useState(0);
  const [mediaUrl, setMediaUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [isFlash, setIsFlash] = useState(false);
  const [price, setPrice] = useState("");
  const [placement, setPlacement] = useState("");
  const [selectedStyleIds, setSelectedStyleIds] = useState<string[]>([]);
  const [customTags, setCustomTags] = useState<string[]>([]);

  const priceCents = price ? Math.round(Number(price) * 100) : null;

  function close() {
    router.back();
  }
  function back() {
    if (step === 0) close();
    else setStep((s) => s - 1);
  }

  async function publish() {
    try {
      const mediaEntry: Record<string, unknown> = { url: mediaUrl };
      if (isFlash) {
        mediaEntry.is_flash = true;
        if (priceCents != null) mediaEntry.price_cents = priceCents;
      }
      if (placement.trim()) mediaEntry.placement = placement.trim();
      if (customTags.length > 0) mediaEntry.custom_style_tags = customTags;

      const post = await mutations.create.mutateAsync({
        caption: caption.trim() || null,
        media: [mediaEntry],
        cover_url: mediaUrl,
        is_public: true,
        source: "inkd",
      });
      if (selectedStyleIds.length > 0) {
        await mutations.setStyles.mutateAsync({ postId: post.id, styleIds: selectedStyleIds });
      }
      toast({ title: "Post published", variant: "success" });
      router.back();
    } catch (err) {
      toast({
        title: "Couldn't publish post",
        description: err instanceof Error ? err.message : undefined,
        variant: "danger",
      });
    }
  }

  // Step 1 — Media
  if (step === 0) {
    return (
      <StepScaffold
        title="Add media"
        prompt="Pick a photo or video to share in your feed."
        stepIndex={0}
        stepCount={STEP_COUNT}
        onBack={back}
        onClose={close}
        onNext={() => setStep(1)}
        canNext={Boolean(mediaUrl)}
      >
        <ImageUploadField
          userId={userId}
          folder="posts"
          value={mediaUrl}
          onChange={setMediaUrl}
          label="Tap to add photo or video"
          kinds={["images", "videos"]}
        />
      </StepScaffold>
    );
  }

  // Step 2 — Caption
  if (step === 1) {
    return (
      <StepScaffold
        title="Write a caption"
        prompt="Say something about this piece. Posts are caption-first."
        stepIndex={1}
        stepCount={STEP_COUNT}
        onBack={back}
        onClose={close}
        onNext={() => setStep(2)}
      >
        <TextArea
          placeholder="What's the story behind this one?"
          value={caption}
          onChangeText={setCaption}
          numberOfLines={5}
        />
      </StepScaffold>
    );
  }

  // Step 3 — Flash & styles
  if (step === 2) {
    return (
      <StepScaffold
        title="Flash & styles"
        prompt="Make it bookable flash with a price, and tag the styles it shows."
        stepIndex={2}
        stepCount={STEP_COUNT}
        onBack={back}
        onClose={close}
        onNext={() => setStep(3)}
      >
        <View className="gap-3 rounded-xl border border-border-subtle bg-surface-raised p-4">
          <Toggle
            checked={isFlash}
            onCheckedChange={setIsFlash}
            label="This is bookable flash"
          />
          {isFlash && (
            <FormField label="Price ($)">
              <Input keyboardType="numeric" value={price} onChangeText={setPrice} placeholder="150" />
            </FormField>
          )}
        </View>
        <FormField label="Placement (optional)">
          <Input value={placement} onChangeText={setPlacement} placeholder="Forearm, ribs, calf…" />
        </FormField>
        <StyleSuggestInput
          options={options}
          selectedKeys={selectedStyleIds}
          onToggleKey={(key) =>
            setSelectedStyleIds((prev) =>
              prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
            )
          }
          customTags={customTags}
          onAddCustom={(text) =>
            setCustomTags((prev) => (prev.includes(text) ? prev : [...prev, text]))
          }
          onRemoveCustom={(text) => setCustomTags((prev) => prev.filter((t) => t !== text))}
        />
      </StepScaffold>
    );
  }

  // Step 4 — Review & publish
  const selectedStyleLabels = options
    .filter((o) => selectedStyleIds.includes(o.key))
    .map((o) => o.label);

  return (
    <StepScaffold
      title="Review & publish"
      prompt="Here's how this post will appear."
      stepIndex={3}
      stepCount={STEP_COUNT}
      onBack={back}
      onClose={close}
      onNext={publish}
      nextLabel="Publish post"
      loading={mutations.create.isPending || mutations.setStyles.isPending}
    >
      <View className="overflow-hidden rounded-2xl border border-border-subtle bg-surface-raised">
        {mediaUrl ? (
          <Image source={{ uri: mediaUrl }} className="aspect-square w-full" resizeMode="cover" />
        ) : (
          <View className="aspect-square w-full items-center justify-center">
            <Icon name="image" size={28} color={colors.text.muted} />
          </View>
        )}
        <View className="gap-2 p-4">
          {caption.trim() ? (
            <Text className="text-sm text-content-primary">{caption.trim()}</Text>
          ) : (
            <Text className="text-sm italic text-content-muted">No caption</Text>
          )}
          <View className="flex-row flex-wrap gap-1.5 pt-1">
            {isFlash ? (
              <Badge variant="brand" size="sm">
                {`Flash · ${flashPriceLabel(priceCents)}`}
              </Badge>
            ) : null}
            {placement.trim() ? (
              <Badge variant="outline" size="sm">
                {placement.trim()}
              </Badge>
            ) : null}
            {[...selectedStyleLabels, ...customTags].map((t) => (
              <Badge key={t} variant="neutral" size="sm">
                {t}
              </Badge>
            ))}
          </View>
        </View>
      </View>
    </StepScaffold>
  );
}
