import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import { Image, Pressable, Text, View } from "react-native";
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
  usePortfolioPieces,
  usePortfolioMutations,
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
    const { data: styles } = useStyles();
    const { data: pieces } = usePortfolioPieces(artist.id);
    const { deletePiece } = usePortfolioMutations(artist.id);

    const [displayName, setDisplayName] = useState(profile.display_name ?? "");
    const [handle, setHandle] = useState(profile.handle ?? "");
    const [bio, setBio] = useState(artist.bio ?? profile.bio ?? "");
    const [selectedStyles, setSelectedStyles] = useState<string[]>(
      artist.styles ?? [],
    );
    const [handleState, setHandleState] = useState<HandleState>("idle");

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
            <Avatar src={profile.avatar_url ?? undefined} name={displayName || "You"} size="xl" />
            <Pressable
              disabled
              accessibilityRole="button"
              accessibilityLabel="Add from library — coming soon"
              className="absolute -bottom-1 -right-1 h-8 w-8 items-center justify-center rounded-full border border-border-strong bg-surface-overlay opacity-50"
            >
              <Icon name="image" size={15} color="#71717A" />
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
              disabled
              accessibilityRole="button"
              accessibilityLabel="Add images — coming soon"
              className="h-24 w-24 items-center justify-center gap-1.5 rounded-xl border border-dashed border-border-strong bg-surface-raised/40 opacity-50"
            >
              <Icon name="plus" size={18} color="#71717A" />
              <Text className="text-[11px] font-sans-medium text-content-muted">Add images</Text>
            </Pressable>
          </View>

          {/* Instagram import — coming soon */}
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
                  Pull your posts in as portfolio pieces.
                </Text>
              </View>
            </View>
            <Badge variant="outline">Coming soon</Badge>
          </View>
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
