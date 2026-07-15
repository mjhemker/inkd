import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import { Image, Linking, Pressable, Text, View } from "react-native";
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
  useInstagramStatus,
  useInstagramAuthorizeUrl,
  useStartInstagramImport,
} from "@inkd/core/hooks";

import type { EditorHandle } from "./types";

type HandleState = "idle" | "checking" | "available" | "taken" | "invalid";

export interface IdentityEditorProps {
  profile: Profile;
  artist: ArtistProfile;
  variant?: "onboarding" | "settings";
}

export const IdentityEditor = forwardRef<EditorHandle, IdentityEditorProps>(
  function IdentityEditor({ profile, artist, variant = "onboarding" }, ref) {
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

    return (
      <View className="gap-7">
        {/* Avatar + name */}
        <View className="flex-row items-center gap-4">
          <View>
            <Avatar src={avatarUrl || undefined} name={displayName || "You"} size="xl" />
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
                <Icon name="image" size={15} color="#71717A" />
              )}
            </Pressable>
          </View>
          <View className="flex-1">
            <FormField label="Display name" required>
              <Input
                placeholder="Jayden Cole"
                value={displayName}
                onChangeText={setDisplayName}
                leadingIcon={<Icon name="user" size={16} color="#71717A" />}
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
            placeholder="jayden.ink"
            autoCapitalize="none"
            value={handle}
            invalid={handleState === "taken" || handleState === "invalid"}
            onChangeText={(v) => setHandle(v.replace(/\s/g, ""))}
            leadingIcon={<Text className="font-mono text-sm text-content-muted">@</Text>}
            trailingIcon={
              handleState === "checking" ? (
                <Spinner size="small" />
              ) : handleState === "available" ? (
                <Icon name="check" size={16} color="#A78BFA" />
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
            </View>
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
                  <Icon name="x" size={13} color="#A1A1AA" />
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
                  <Icon name="plus" size={18} color="#71717A" />
                  <Text className="text-[11px] font-sans-medium text-content-muted">Add images</Text>
                </>
              )}
            </Pressable>
          </View>

          <InstagramImportRow artistId={artist.id} />
        </View>

        {variant === "settings" && (
          <View className="items-end">
            <Button onPress={() => void save()} loading={saving}>
              Save changes
            </Button>
          </View>
        )}
      </View>
    );
  },
);

/**
 * The portfolio section's Instagram row — shared by onboarding + settings.
 * Reads the same config/connection state the full "Connected accounts"
 * settings section does (`useInstagramStatus`), so this affordance is never
 * out of sync with reality: "Coming soon" only shows while Michael hasn't set
 * the Meta app secrets (see docs/instagram-integration.md §5); once
 * configured it's a real Connect / Import control.
 */
function InstagramImportRow({ artistId }: { artistId: string }) {
  const { toast } = useToast();
  const { data: status } = useInstagramStatus(artistId);
  const authorizeUrl = useInstagramAuthorizeUrl();
  const startImport = useStartInstagramImport(artistId);

  async function connect() {
    try {
      const { url } = await authorizeUrl.mutateAsync();
      await Linking.openURL(url);
    } catch (err) {
      toast({
        title: "Couldn't start Instagram connect",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "danger",
      });
    }
  }

  async function runImport() {
    try {
      const summary = await startImport.mutateAsync();
      toast({
        title: "Instagram import ran",
        description:
          summary.postsCreated > 0
            ? `${summary.postsCreated} new ${summary.postsCreated === 1 ? "piece" : "pieces"} imported.`
            : "Everything is already imported.",
        variant: "success",
      });
    } catch (err) {
      toast({
        title: "Import failed",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "danger",
      });
    }
  }

  const configured = status?.configured ?? false;
  const connected = status?.connected ?? false;

  return (
    <View className="flex-row items-center justify-between rounded-xl border border-border-subtle bg-surface-raised/40 px-4 py-3">
      <View className="flex-1 flex-row items-center gap-3">
        <View className="h-8 w-8 items-center justify-center rounded-lg bg-surface-overlay">
          <Icon name="image" size={16} color="#71717A" />
        </View>
        <View className="flex-1">
          <Text className="text-sm font-sans-medium text-content-secondary">
            Import from Instagram
          </Text>
          <Text className="text-xs text-content-muted">
            {connected && status?.ig_username
              ? `Connected as @${status.ig_username}`
              : "Pull your posts in as portfolio pieces."}
          </Text>
        </View>
      </View>
      {!configured ? (
        <Badge variant="outline">Coming soon</Badge>
      ) : connected ? (
        <Button
          size="sm"
          variant="outline"
          onPress={() => void runImport()}
          loading={startImport.isPending}
        >
          Import
        </Button>
      ) : (
        <Button
          size="sm"
          variant="outline"
          onPress={() => void connect()}
          loading={authorizeUrl.isPending}
        >
          Connect
        </Button>
      )}
    </View>
  );
}
