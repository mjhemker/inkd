import { useMemo, useState } from "react";
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
  usePortfolioMutations,
  usePortfolioPieces,
} from "@inkd/core";

import { ArtistOnly } from "@/components/ArtistOnly";
import { ImageUploadField } from "@/components/profile/ImageUploadField";
import { StepScaffold } from "@/components/create/StepScaffold";
import { StyleSuggestInput } from "@/components/create/StyleSuggestInput";
import { useStyleOptions } from "@/components/create/useStyleOptions";
import { useTheme } from "@/providers/theme";

/**
 * Progressive, full-screen "Add to portfolio" flow (replaces the old inline
 * sheet). One prompt per screen:
 *   1 Photo → 2 Details (title + description) → 3 Placement & styles
 *   (placement, fresh/healed, styles) → 4 Review & publish
 *
 * A portfolio piece is gallery / booking-credibility content: placement and
 * healed-vs-fresh state matter, and the piece is ordered in the gallery. See
 * docs/content-model.md.
 */
export default function AddPortfolioFlow() {
  return (
    <ArtistOnly requireOnboarding>
      <ToastProvider>
        <PortfolioFlowInner />
      </ToastProvider>
    </ArtistOnly>
  );
}

const STEP_COUNT = 4;

function PortfolioFlowInner() {
  const { colors } = useTheme();
  const { toast } = useToast();
  const { data: profile } = useCurrentProfile();
  const { data: artist } = useCurrentArtistProfile();
  const artistId = artist?.id ?? "";
  const userId = profile?.id ?? "";

  const mutations = usePortfolioMutations(artistId);
  const { data: pieces } = usePortfolioPieces(artistId);

  const recentSlugs = useMemo(() => {
    const seen = new Set<string>();
    for (const p of pieces ?? []) for (const t of p.style_tags ?? []) seen.add(t);
    return [...seen];
  }, [pieces]);
  const { options } = useStyleOptions({ artistId, keyBy: "slug", recentSlugs });

  const [step, setStep] = useState(0);
  const [imageUrl, setImageUrl] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [placement, setPlacement] = useState("");
  const [isHealed, setIsHealed] = useState(false);
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);
  const [customTags, setCustomTags] = useState<string[]>([]);

  const allTags = useMemo(
    () => [...new Set([...selectedSlugs, ...customTags])],
    [selectedSlugs, customTags],
  );

  function close() {
    router.back();
  }
  function back() {
    if (step === 0) close();
    else setStep((s) => s - 1);
  }

  async function publish() {
    try {
      await mutations.create.mutateAsync({
        image_url: imageUrl,
        title: title.trim() || null,
        description: description.trim() || null,
        placement: placement.trim() || null,
        is_healed: isHealed,
        is_public: true,
        style_tags: allTags,
      });
      toast({ title: "Added to portfolio", variant: "success" });
      router.back();
    } catch (err) {
      toast({
        title: "Couldn't add piece",
        description: err instanceof Error ? err.message : undefined,
        variant: "danger",
      });
    }
  }

  // Step 1 — Photo
  if (step === 0) {
    return (
      <StepScaffold
        title="Add a photo"
        prompt="Upload a clean, well-lit shot of the tattoo. This is your gallery proof."
        stepIndex={0}
        stepCount={STEP_COUNT}
        onBack={back}
        onClose={close}
        onNext={() => setStep(1)}
        canNext={Boolean(imageUrl)}
      >
        <ImageUploadField
          userId={userId}
          folder="portfolio"
          value={imageUrl}
          onChange={setImageUrl}
          label="Tap to add a photo"
        />
      </StepScaffold>
    );
  }

  // Step 2 — Details
  if (step === 1) {
    return (
      <StepScaffold
        title="Details"
        prompt="Give it a title and a short description. Both are optional."
        stepIndex={1}
        stepCount={STEP_COUNT}
        onBack={back}
        onClose={close}
        onNext={() => setStep(2)}
      >
        <FormField label="Title">
          <Input value={title} onChangeText={setTitle} placeholder="Blackwork raven" />
        </FormField>
        <FormField label="Description">
          <TextArea value={description} onChangeText={setDescription} numberOfLines={3} />
        </FormField>
      </StepScaffold>
    );
  }

  // Step 3 — Placement & styles
  if (step === 2) {
    return (
      <StepScaffold
        title="Placement & styles"
        prompt="Where it sits, whether it's healed, and the styles it shows."
        stepIndex={2}
        stepCount={STEP_COUNT}
        onBack={back}
        onClose={close}
        onNext={() => setStep(3)}
      >
        <FormField label="Placement">
          <Input value={placement} onChangeText={setPlacement} placeholder="Forearm, ribs, calf…" />
        </FormField>
        <Toggle
          checked={isHealed}
          onCheckedChange={setIsHealed}
          label={isHealed ? "Fully healed" : "Fresh / just done"}
        />
        <StyleSuggestInput
          options={options}
          selectedKeys={selectedSlugs}
          onToggleKey={(key) =>
            setSelectedSlugs((prev) =>
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
  return (
    <StepScaffold
      title="Review & publish"
      prompt="Here's how this piece will appear in your gallery."
      stepIndex={3}
      stepCount={STEP_COUNT}
      onBack={back}
      onClose={close}
      onNext={publish}
      nextLabel="Publish to portfolio"
      loading={mutations.create.isPending}
    >
      <View className="overflow-hidden rounded-2xl border border-border-subtle bg-surface-raised">
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} className="aspect-square w-full" resizeMode="cover" />
        ) : (
          <View className="aspect-square w-full items-center justify-center">
            <Icon name="image" size={28} color={colors.text.muted} />
          </View>
        )}
        <View className="gap-2 p-4">
          <Text className="font-display text-lg text-content-primary">
            {title.trim() || "Untitled piece"}
          </Text>
          {description.trim() ? (
            <Text className="text-sm text-content-secondary">{description.trim()}</Text>
          ) : null}
          <View className="flex-row flex-wrap gap-1.5 pt-1">
            <Badge variant={isHealed ? "success" : "outline"} size="sm">
              {isHealed ? "Healed" : "Fresh"}
            </Badge>
            {placement.trim() ? (
              <Badge variant="outline" size="sm">
                {placement.trim()}
              </Badge>
            ) : null}
            {allTags.map((t) => (
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
