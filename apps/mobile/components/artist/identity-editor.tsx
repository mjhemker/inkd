import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import { Image, Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import {
  Avatar,
  Badge,
  Button,
  Chip,
  FormField,
  Icon,
  Input,
  Spinner,
  TextArea,
  useToast,
} from "@inkd/ui/native";
import { isHandleAvailable, type ArtistProfile, type Profile } from "@inkd/core";
import {
  useInkdClient,
  useStyles,
  useUpdateArtistProfile,
  useUpdateProfile,
  useUploadMedia,
  usePortfolioPieces,
  usePortfolioMutations,
} from "@inkd/core/hooks";

import type { EditorHandle } from "./types";
import { useTheme } from "@/providers/theme";
import { useInstagramStatus } from "@/lib/instagram";
import {
  consumeImportResult,
  stashOnboardingResume,
  useInstagramConnect,
} from "@/lib/instagramConnect";

type HandleState = "idle" | "checking" | "available" | "taken" | "invalid";

/** Normalize free-text into a slug-like token stored alongside taxonomy slugs. */
function slugifyStyle(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** Prettify a slug (taxonomy or custom) for display, e.g. "neo-traditional". */
function prettifyStyle(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export interface IdentityEditorProps {
  profile: Profile;
  artist: ArtistProfile;
  variant?: "onboarding" | "settings";
  /** In onboarding, the step to resume at after the Instagram round-trip. */
  onboardingResumeStep?: number;
}

export const IdentityEditor = forwardRef<EditorHandle, IdentityEditorProps>(
  function IdentityEditor(
    { profile, artist, variant = "onboarding", onboardingResumeStep },
    ref,
  ) {
    const { colors } = useTheme();
    const { toast } = useToast();
    const client = useInkdClient();
    const updateProfile = useUpdateProfile(profile.id);
    const updateArtist = useUpdateArtistProfile(artist.id);
    const uploadMedia = useUploadMedia(profile.id);
    const { data: styles } = useStyles();
    const { data: pieces } = usePortfolioPieces(artist.id);
    const { create: createPiece, remove: deletePiece } = usePortfolioMutations(artist.id);

    const [displayName, setDisplayName] = useState(profile.display_name ?? "");
    const [handle, setHandle] = useState(profile.handle ?? "");
    const [bio, setBio] = useState(artist.bio ?? profile.bio ?? "");
    const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? "");
    // The picker's local file URI — shown immediately so the avatar never
    // regresses to the (enlarged, at this size) initials fallback while the
    // upload is in flight. Cleared once the real `avatarUrl` (the uploaded
    // public URL) takes over.
    const [previewUri, setPreviewUri] = useState<string | null>(null);
    const [selectedStyles, setSelectedStyles] = useState<string[]>(
      artist.styles ?? [],
    );
    const [handleState, setHandleState] = useState<HandleState>("idle");
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [portfolioProgress, setPortfolioProgress] = useState<{ done: number; total: number } | null>(null);

    const originalHandle = useMemo(
      () => (profile.handle ?? "").toLowerCase(),
      [profile.handle],
    );

    // Debounced handle availability check.
    useEffect(() => {
      const trimmed = handle.trim();
      if (trimmed.toLowerCase() === originalHandle && trimmed !== "") {
        setHandleState("idle");
        return;
      }
      if (trimmed === "") {
        setHandleState("idle");
        return;
      }
      if (!/^[a-z0-9._]{2,30}$/i.test(trimmed)) {
        setHandleState("invalid");
        return;
      }
      setHandleState("checking");
      const t = setTimeout(async () => {
        try {
          const free = await isHandleAvailable(client, trimmed);
          setHandleState(free ? "available" : "taken");
        } catch {
          setHandleState("idle");
        }
      }, 400);
      return () => clearTimeout(t);
    }, [handle, originalHandle, client]);

    async function requestLibraryAccess(): Promise<boolean> {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        toast({
          title: "Photo access is off",
          description: "Enable photo access in Settings to upload.",
          variant: "danger",
        });
        return false;
      }
      return true;
    }

    async function pickAvatar() {
      if (!(await requestLibraryAccess())) return;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.85,
        allowsEditing: true,
        aspect: [1, 1],
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset) return;

      // Show the picked photo immediately from its local file URI — the
      // actual upload + public-URL round trip happens in the background.
      setPreviewUri(asset.uri);
      setUploadingAvatar(true);
      try {
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        const { publicUrl } = await uploadMedia.mutateAsync({
          folder: "avatars",
          file: {
            data: blob,
            name: asset.fileName ?? `avatar-${Date.now()}.jpg`,
            contentType: asset.mimeType ?? "image/jpeg",
          },
        });
        setAvatarUrl(publicUrl);
        await updateProfile.mutateAsync({ avatar_url: publicUrl });
        toast({ title: "Avatar updated", variant: "success" });
      } catch (err) {
        toast({
          title: "Upload failed",
          description: err instanceof Error ? err.message : "Try another image.",
          variant: "danger",
        });
      } finally {
        setUploadingAvatar(false);
        setPreviewUri(null);
      }
    }

    async function pickPortfolioImages() {
      if (!(await requestLibraryAccess())) return;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.85,
        allowsMultipleSelection: true,
      });
      if (result.canceled || result.assets.length === 0) return;

      const assets = result.assets;
      setPortfolioProgress({ done: 0, total: assets.length });
      let failed = 0;
      for (let i = 0; i < assets.length; i++) {
        const asset = assets[i]!;
        try {
          const response = await fetch(asset.uri);
          const blob = await response.blob();
          const { publicUrl } = await uploadMedia.mutateAsync({
            folder: "portfolio",
            file: {
              data: blob,
              name: asset.fileName ?? `portfolio-${Date.now()}-${i}.jpg`,
              contentType: asset.mimeType ?? "image/jpeg",
            },
          });
          await createPiece.mutateAsync({ image_url: publicUrl, is_public: true });
        } catch {
          failed += 1;
        } finally {
          setPortfolioProgress({ done: i + 1, total: assets.length });
        }
      }
      setPortfolioProgress(null);
      if (failed > 0) {
        toast({
          title: failed === assets.length ? "Upload failed" : "Some uploads failed",
          description: `${assets.length - failed} of ${assets.length} added.`,
          variant: "danger",
        });
      } else {
        toast({ title: "Portfolio updated", variant: "success" });
      }
    }

    async function save(): Promise<boolean> {
      if (!displayName.trim()) {
        toast({ title: "Add your name to continue", variant: "danger" });
        return false;
      }
      if (!handle.trim() || handleState === "taken" || handleState === "invalid") {
        toast({ title: "Pick an available handle", variant: "danger" });
        return false;
      }
      try {
        await updateProfile.mutateAsync({
          display_name: displayName.trim(),
          handle: handle.trim(),
          bio: bio.trim() || null,
        });
        await updateArtist.mutateAsync({
          bio: bio.trim() || null,
          styles: selectedStyles,
        });
        return true;
      } catch (err) {
        toast({
          title: "Couldn't save",
          description: err instanceof Error ? err.message : "Try again.",
          variant: "danger",
        });
        return false;
      }
    }

    useImperativeHandle(ref, () => ({ save }));

    const saving = updateProfile.isPending || updateArtist.isPending;

    function toggleStyle(slug: string) {
      setSelectedStyles((prev) =>
        prev.includes(slug)
          ? prev.filter((s) => s !== slug)
          : prev.length >= 8
            ? prev
            : [...prev, slug],
      );
    }

    // Custom ("add your own") styles: free text a taxonomy chip can't cover.
    // They persist in the same artist_profiles.styles text[] as taxonomy slugs
    // (no FK, no migration) — see updateArtistProfile.
    const taxonomySlugs = useMemo(
      () => new Set((styles ?? []).map((s) => s.slug)),
      [styles],
    );
    const customStyles = selectedStyles.filter((s) => !taxonomySlugs.has(s));
    const [customOpen, setCustomOpen] = useState(false);
    const [customInput, setCustomInput] = useState("");

    function addCustomStyle() {
      const slug = slugifyStyle(customInput);
      setCustomInput("");
      if (!slug) return;
      setSelectedStyles((prev) =>
        prev.includes(slug) || prev.length >= 8 ? prev : [...prev, slug],
      );
    }

    return (
      <View className="gap-7">
        {/* Avatar + name */}
        <View className="flex-row items-center gap-4">
          <View>
            <Avatar
              src={previewUri ?? (avatarUrl || undefined)}
              name={displayName || "You"}
              size="xl"
            />
            <Pressable
              onPress={() => void pickAvatar()}
              disabled={uploadingAvatar}
              accessibilityRole="button"
              accessibilityLabel="Upload avatar"
              className="absolute -bottom-1 -right-1 h-8 w-8 items-center justify-center rounded-full border border-border-strong bg-surface-overlay"
            >
              {uploadingAvatar ? (
                <Spinner size="small" />
              ) : (
                <Icon name="image" size={15} color={colors.text.muted} />
              )}
            </Pressable>
          </View>
          <View className="flex-1">
            <FormField label="Display name" required>
              <Input
                placeholder="Your name"
                value={displayName}
                onChangeText={setDisplayName}
                leadingIcon={<Icon name="user" size={16} color={colors.text.muted} />}
              />
            </FormField>
          </View>
        </View>

        {/* Handle */}
        <FormField
          label="Handle"
          required
          description="Your public @ on INKD."
          error={
            handleState === "invalid"
              ? "Use 2–30 letters, numbers, dots or underscores."
              : handleState === "taken"
                ? "That handle is taken."
                : undefined
          }
        >
          <Input
            placeholder="yourhandle"
            autoCapitalize="none"
            value={handle}
            invalid={handleState === "taken" || handleState === "invalid"}
            onChangeText={(v) => setHandle(v.replace(/\s/g, ""))}
            leadingIcon={<Text className="font-mono text-sm text-content-muted">@</Text>}
            trailingIcon={
              handleState === "checking" ? (
                <Spinner size="small" />
              ) : handleState === "available" ? (
                <Icon name="check" size={16} color={colors.text.accent} />
              ) : undefined
            }
          />
        </FormField>
        {handleState === "available" && (
          <Text className="-mt-4 text-sm text-content-accent">
            @{handle.trim()} is available.
          </Text>
        )}

        {/* Bio */}
        <FormField label="Bio" description="A line or two clients read first.">
          <TextArea
            numberOfLines={3}
            placeholder="Baltimore-based, blackwork & fine line. Booking custom pieces and touch-ups."
            value={bio}
            onChangeText={setBio}
          />
        </FormField>

        {/* Styles */}
        {styles && styles.length > 0 && (
          <View className="gap-2.5">
            <Text className="text-sm font-sans-medium text-content-primary">
              Styles you work in
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {styles.map((s) => (
                <Chip
                  key={s.id}
                  selected={selectedStyles.includes(s.slug)}
                  onPress={() => toggleStyle(s.slug)}
                >
                  {s.name}
                </Chip>
              ))}
              {/* Custom styles the artist added themselves. */}
              {customStyles.map((slug) => (
                <Chip key={`custom:${slug}`} selected onPress={() => toggleStyle(slug)}>
                  {prettifyStyle(slug)}
                </Chip>
              ))}
              {!customOpen && (
                <Pressable
                  onPress={() => setCustomOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Add your own style"
                  className="flex-row items-center gap-1 rounded-sm border border-dashed border-border-strong px-3 py-1.5"
                >
                  <Icon name="plus" size={13} color={colors.text.muted} />
                  <Text className="text-xs font-sans-medium text-content-secondary">Add your own</Text>
                </Pressable>
              )}
            </View>
            {customOpen && (
              <View className="flex-row items-center gap-2">
                <View className="flex-1">
                  <Input
                    size="sm"
                    value={customInput}
                    onChangeText={setCustomInput}
                    onSubmitEditing={addCustomStyle}
                    placeholder="e.g. Chicano, dotwork…"
                    autoFocus
                    returnKeyType="done"
                    accessibilityLabel="Add a custom style"
                  />
                </View>
                <Button size="sm" variant="outline" onPress={addCustomStyle}>
                  Add
                </Button>
                <Pressable
                  onPress={() => {
                    setCustomOpen(false);
                    setCustomInput("");
                  }}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel"
                  className="h-8 w-8 items-center justify-center"
                >
                  <Icon name="x" size={15} color={colors.text.muted} />
                </Pressable>
              </View>
            )}
          </View>
        )}

        {/* Portfolio */}
        <View className="gap-3">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-sans-medium text-content-primary">
              Portfolio
              {pieces && pieces.length > 0 ? (
                <Text className="font-mono text-xs text-content-muted"> · {pieces.length} {pieces.length === 1 ? "piece" : "pieces"}</Text>
              ) : null}
            </Text>
          </View>

          <View className="flex-row flex-wrap gap-2.5">
            {pieces?.map((p) => (
              <View
                key={p.id}
                className="h-24 w-24 overflow-hidden rounded-xl border border-border-subtle bg-surface-overlay"
              >
                {p.image_url ? (
                  <Image source={{ uri: p.image_url }} className="h-full w-full" resizeMode="cover" />
                ) : null}
                <Pressable
                  onPress={() => deletePiece.mutate(p.id)}
                  accessibilityRole="button"
                  accessibilityLabel="Remove piece"
                  className="absolute right-1 top-1 h-6 w-6 items-center justify-center rounded-full bg-surface-base/80"
                >
                  <Icon name="x" size={13} color={colors.text.secondary} />
                </Pressable>
              </View>
            ))}

            <Pressable
              onPress={() => void pickPortfolioImages()}
              disabled={portfolioProgress !== null}
              accessibilityRole="button"
              accessibilityLabel="Add images"
              className="h-24 w-24 items-center justify-center gap-1.5 rounded-xl border border-dashed border-border-strong bg-surface-raised/40"
            >
              {portfolioProgress ? (
                <>
                  <Spinner size="small" />
                  <Text className="text-[11px] font-sans-medium text-content-muted">
                    {portfolioProgress.done}/{portfolioProgress.total}
                  </Text>
                </>
              ) : (
                <>
                  <Icon name="plus" size={18} color={colors.text.muted} />
                  <Text className="text-[11px] font-sans-medium text-content-muted">Add images</Text>
                </>
              )}
            </Pressable>
          </View>

          <InstagramCard
            artistId={artist.id}
            variant={variant}
            onboardingResumeStep={onboardingResumeStep}
          />
        </View>

        {variant === "settings" && (
          <Button hero className="w-full" onPress={() => void save()} loading={saving}>
            Save changes
          </Button>
        )}
      </View>
    );
  },
);

/**
 * "Import your work from Instagram" — shown in the portfolio section beside
 * manual upload, in both onboarding Step 1 and settings (guide §3.A). State
 * comes from `useInstagramStatus` so the affordance is never out of sync:
 * "Coming soon" only while the Meta app secrets are unset; otherwise a real
 * Connect / Import control. Connect runs the auth-session handoff, polls the
 * true status, then drops the artist into the selection picker; on return the
 * picker's imported-count surfaces here as "N pieces added to your portfolio".
 */
function InstagramCard({
  artistId,
  variant,
  onboardingResumeStep,
}: {
  artistId: string;
  variant: "onboarding" | "settings";
  onboardingResumeStep?: number;
}) {
  const { colors } = useTheme();
  const { toast } = useToast();
  const router = useRouter();
  const qc = useQueryClient();
  const { data: status } = useInstagramStatus(artistId);
  const { connect, connecting } = useInstagramConnect(
    artistId,
    variant === "onboarding" ? "/onboarding" : undefined,
  );

  // On return from the picker, surface "N pieces added" + refresh the grid.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        const added = await consumeImportResult();
        if (!active || !added || added <= 0) return;
        toast({
          title: `${added} ${added === 1 ? "piece" : "pieces"} added to your portfolio`,
          variant: "success",
        });
        qc.invalidateQueries({ queryKey: ["portfolioPieces", artistId] });
      })();
      return () => {
        active = false;
      };
    }, [artistId, qc, toast]),
  );

  function markResume() {
    if (variant === "onboarding" && onboardingResumeStep != null) {
      void stashOnboardingResume(onboardingResumeStep);
    }
  }

  function goToPicker() {
    markResume();
    router.push(`/instagram/import?origin=${variant === "onboarding" ? "onboarding" : "settings"}` as never);
  }

  async function handleConnect() {
    markResume();
    const outcome = await connect();
    if (outcome.ok) {
      toast({
        title: `Connected as @${outcome.status.igUsername ?? "instagram"}`,
        variant: "success",
      });
      goToPicker(); // straight into selection
    } else if (outcome.reason === "error") {
      toast({
        title: "Couldn't connect to Instagram",
        description: outcome.message ?? "Try again.",
        variant: "danger",
      });
    }
    // "not_connected" (cancelled / stranded) → quiet.
  }

  const state = status?.state ?? "notConnected";

  const subtitle =
    state === "connected"
      ? `Connected as @${status?.igUsername ?? "instagram"}`
      : state === "tokenExpired"
        ? "Reconnect to import your posts."
        : state === "comingSoon"
          ? "Available soon — no update needed."
          : "Requires an Instagram Business or Creator account.";

  return (
    <View className="flex-row items-center justify-between rounded-xl border border-border-subtle bg-surface-raised/40 px-4 py-3">
      <View className="flex-1 flex-row items-center gap-3">
        <View className="h-8 w-8 items-center justify-center rounded-lg bg-surface-overlay">
          <Feather name="instagram" size={16} color={colors.text.muted} />
        </View>
        <View className="flex-1">
          <Text className="text-sm font-sans-medium text-content-secondary">
            Import your work from Instagram
          </Text>
          <Text className="text-xs text-content-muted">{subtitle}</Text>
        </View>
      </View>
      {state === "comingSoon" ? (
        <Badge variant="outline">Coming soon</Badge>
      ) : state === "connected" ? (
        <Button size="sm" variant="outline" onPress={goToPicker}>
          Import
        </Button>
      ) : state === "tokenExpired" ? (
        <Button size="sm" variant="outline" onPress={() => void handleConnect()} loading={connecting}>
          Reconnect
        </Button>
      ) : (
        <Button size="sm" variant="outline" onPress={() => void handleConnect()} loading={connecting}>
          Connect
        </Button>
      )}
    </View>
  );
}
