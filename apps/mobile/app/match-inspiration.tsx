/**
 * "Match my inspiration" (mobile) — the on-device counterpart to
 * apps/web's MatchInspirationView, over the same shared core
 * (`matchInspirationFromUrl` + `@inkd/core/api`). Flow:
 *   upload/snap an inspiration photo
 *     → upload to a PRIVATE, transient path + sign it (uploadInspirationImage)
 *     → the WEB app's /api/match-inspiration proxies the bearer-gated tag step
 *       (mobile can't call the AI-runtime-gated edge function directly, so it
 *       calls the same proxy web calls, over EXPO_PUBLIC_MATCH_INSPO_URL, with
 *       the user's own Supabase access token as the bearer)
 *     → show "what INKD saw" (detected styles + color/placement chips)
 *     → ranked, grouped matching artists, with the graceful no_style /
 *       no_match / low_match degradations mirrored from web
 * The inspiration image is deleted right after tagging — never stored.
 *
 * Refine-by-style and the discover-filter intersection are web-only for this
 * wave (see the task brief) — mobile keeps the flow to upload → results.
 */
import { useState } from "react";
import { Alert, Image, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Avatar, Icon, Spinner } from "@inkd/ui/native";
import { useCurrentProfile, useInkdClient } from "@inkd/core/hooks";
import { useTheme } from "@/providers/theme";
import {
  CLOSE_MATCH_THRESHOLD,
  STRONG_MATCH_THRESHOLD,
  deleteInspirationImage,
  matchInspirationFromUrl,
  uploadInspirationImage,
  InspirationTagError,
  type InspirationSummary,
  type MatchArtistGroup,
  type MatchOutcome,
  type MatchWork,
} from "@inkd/core/api";

const BRAND = "#7C3AED";

const RESULT_LIMIT = 40;
// Web hosts the bearer-gated tag proxy; mobile calls it over the network
// rather than a local API route. Unset in dev until wired up — see
// apps/mobile/.env.example.
const MATCH_ENDPOINT = process.env.EXPO_PUBLIC_MATCH_INSPO_URL;

type Phase = "idle" | "working" | "results" | "error";

interface Loaded {
  summary: InspirationSummary;
  groups: MatchArtistGroup[];
  outcome: MatchOutcome;
}

function titleCase(s: string): string {
  return s
    .split(/[\s_-]+/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export default function MatchInspirationScreen() {
  const { colors } = useTheme();
  const client = useInkdClient();
  const { data: profile, isLoading: profileLoading } = useCurrentProfile();

  const [phase, setPhase] = useState<Phase>("idle");
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [notConfigured, setNotConfigured] = useState(false);
  const [picking, setPicking] = useState(false);

  const onBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/discover");
  };

  function reset() {
    setPreviewUri(null);
    setLoaded(null);
    setErrorMsg("");
    setNotConfigured(false);
    setPhase("idle");
  }

  async function handleAsset(asset: ImagePicker.ImagePickerAsset) {
    if (!profile?.id || !MATCH_ENDPOINT) return;
    setPreviewUri(asset.uri);
    setErrorMsg("");
    setNotConfigured(false);
    setLoaded(null);
    setPhase("working");

    let uploadedPath: string | null = null;
    try {
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const uploaded = await uploadInspirationImage(client, profile.id, {
        data: blob,
        name: asset.fileName ?? `inspiration-${Date.now()}.jpg`,
        contentType: asset.mimeType ?? "image/jpeg",
      });
      uploadedPath = uploaded.path;

      const {
        data: { session },
      } = await client.auth.getSession();

      const result = await matchInspirationFromUrl(client, uploaded.signedUrl, {
        endpoint: MATCH_ENDPOINT,
        accessToken: session?.access_token,
        limit: RESULT_LIMIT,
      });
      setLoaded({ summary: result.summary, groups: result.groups, outcome: result.outcome });
      setPhase("results");
    } catch (e) {
      if (e instanceof InspirationTagError && e.code === "not_configured") {
        setNotConfigured(true);
        setPhase("error");
      } else {
        setErrorMsg(e instanceof Error ? e.message : "Something went wrong reading that image.");
        setPhase("error");
      }
    } finally {
      // Transient: the inspiration image is never kept once it's been read.
      if (uploadedPath) void deleteInspirationImage(client, uploadedPath);
    }
  }

  async function pickFromLibrary() {
    setPicking(true);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setErrorMsg("Photo access is off — enable it in Settings to upload.");
        setPhase("error");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.85,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset) return;
      await handleAsset(asset);
    } finally {
      setPicking(false);
    }
  }

  async function takePhoto() {
    setPicking(true);
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        setErrorMsg("Camera access is off — enable it in Settings to take a photo.");
        setPhase("error");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.85,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset) return;
      await handleAsset(asset);
    } finally {
      setPicking(false);
    }
  }

  const signedIn = !!profile?.id;
  const hasResults = loaded && loaded.outcome !== "no_style" && loaded.groups.length > 0;

  return (
    <SafeAreaView className="flex-1 bg-surface-base" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center justify-between border-b border-border-subtle px-4 py-3">
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" hitSlop={10}>
          <Icon name="chevron-left" size={24} color={colors.text.primary} />
        </Pressable>
        <Text className="font-display text-base text-content-primary">Match my inspiration</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerClassName="gap-5 px-4 pb-12 pt-4" keyboardShouldPersistTaps="handled">
        <View className="gap-1">
          <Text className="font-mono text-xs uppercase tracking-widest text-content-muted">
            Search by image
          </Text>
          <Text className="font-display text-2xl text-content-primary">Find your artist by look</Text>
          <Text className="text-sm text-content-secondary">
            Upload a tattoo you love and INKD finds artists whose work matches that aesthetic — by
            style, subject, color and composition.
          </Text>
        </View>

        {!MATCH_ENDPOINT ? (
          <NoEndpointState />
        ) : !signedIn && !profileLoading ? (
          <SignInGate />
        ) : (
          <>
            <UploadPanel
              previewUri={previewUri}
              phase={phase}
              picking={picking}
              onPick={() => void pickFromLibrary()}
              onCamera={() => void takePhoto()}
              onReset={reset}
            />
            <PrivacyNote />

            {phase === "working" ? <WorkingState /> : null}

            {phase === "error" ? (
              <ErrorState
                notConfigured={notConfigured}
                message={errorMsg}
                onRetry={() => void pickFromLibrary()}
              />
            ) : null}

            {phase === "results" && loaded ? (
              <View className="gap-4">
                <DetectedTagsPanel summary={loaded.summary} />

                <MatchResults
                  outcome={loaded.outcome}
                  groups={loaded.groups}
                  summary={loaded.summary}
                  onTryAnother={() => void pickFromLibrary()}
                />

                {hasResults ? <SaveStub /> : null}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function UploadPanel({
  previewUri,
  phase,
  picking,
  onPick,
  onCamera,
  onReset,
}: {
  previewUri: string | null;
  phase: Phase;
  picking: boolean;
  onPick: () => void;
  onCamera: () => void;
  onReset: () => void;
}) {
  if (previewUri) {
    return (
      <View className="flex-row items-center gap-3 rounded-sm border border-dashed border-border-default bg-surface-raised p-4">
        <Image source={{ uri: previewUri }} className="h-20 w-20 rounded-sm" resizeMode="cover" />
        <View className="min-w-0 flex-1 gap-1">
          <Text className="font-display text-sm text-content-primary">Your inspiration</Text>
          <Text className="text-xs text-content-secondary">
            {phase === "working" ? "Reading the aesthetic…" : "Analyzed — not stored."}
          </Text>
          <View className="mt-1 flex-row gap-3">
            <Pressable onPress={onPick} disabled={picking}>
              <Text className="text-xs font-semibold text-content-primary">Replace</Text>
            </Pressable>
            <Pressable onPress={onReset} disabled={picking}>
              <Text className="text-xs font-semibold text-content-muted">Clear</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="gap-2 rounded-sm border border-dashed border-border-default bg-surface-raised p-4">
      <View className="flex-row gap-3">
        <Pressable
          onPress={onPick}
          disabled={picking}
          className="flex-1 items-center gap-2 rounded-sm border border-border-subtle bg-surface-overlay py-6 active:border-border-strong"
        >
          {picking ? <Spinner /> : <Icon name="image" size={24} color={BRAND} />}
          <Text className="font-display text-sm text-content-primary">Upload photo</Text>
        </Pressable>
        <Pressable
          onPress={onCamera}
          disabled={picking}
          className="flex-1 items-center gap-2 rounded-sm border border-border-subtle bg-surface-overlay py-6 active:border-border-strong"
        >
          {picking ? <Spinner /> : <Icon name="image" size={24} color={BRAND} />}
          <Text className="font-display text-sm text-content-primary">Take a photo</Text>
        </Pressable>
      </View>
      <Text className="text-center text-xs text-content-secondary">
        A screenshot, a saved reference, or a snap of a tattoo you love.
      </Text>
    </View>
  );
}

function PrivacyNote() {
  const { colors } = useTheme();
  return (
    <View className="flex-row items-start gap-2 rounded-sm border border-border-subtle bg-surface-overlay p-3">
      <Icon name="sparkles" size={14} color={colors.text.muted} />
      <Text className="flex-1 text-xs leading-relaxed text-content-secondary">
        Your image is read on the fly to detect its style and{" "}
        <Text className="text-content-primary">never stored</Text> — it&rsquo;s deleted the moment
        we&rsquo;ve read it.
      </Text>
    </View>
  );
}

function WorkingState() {
  return (
    <View className="flex-row items-center justify-center gap-3 rounded-sm border border-border-subtle bg-surface-raised py-16">
      <Spinner />
      <Text className="text-sm text-content-secondary">
        Reading the style and finding artists who match…
      </Text>
    </View>
  );
}

function ErrorState({
  notConfigured,
  message,
  onRetry,
}: {
  notConfigured: boolean;
  message: string;
  onRetry: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View className="items-center gap-3 rounded-sm border border-dashed border-border-default bg-surface-raised px-6 py-12">
      <Icon name="alert-triangle" size={26} color={colors.text.muted} />
      <Text className="font-display text-lg text-content-primary">
        {notConfigured ? "Image search isn't switched on yet" : "Couldn't read that image"}
      </Text>
      <Text className="max-w-xs text-center text-sm text-content-secondary">
        {notConfigured
          ? "Image matching is being enabled. Meanwhile you can browse artists by style."
          : message || "Try a different photo of a tattoo."}
      </Text>
      {notConfigured ? (
        <Pressable
          onPress={() => router.push("/(tabs)/discover")}
          className="flex-row items-center gap-1.5 rounded-lg bg-brand px-4 py-2"
        >
          <Icon name="compass" size={15} color="#FFFFFF" />
          <Text className="text-sm font-semibold text-brand-on">Browse by style</Text>
        </Pressable>
      ) : (
        <Pressable
          onPress={onRetry}
          className="flex-row items-center gap-1.5 rounded-lg border border-border-strong px-4 py-2"
        >
          <Icon name="image" size={15} color={colors.text.primary} />
          <Text className="text-sm font-semibold text-content-primary">Try another image</Text>
        </Pressable>
      )}
    </View>
  );
}

function SignInGate() {
  return (
    <View className="items-center gap-3 rounded-sm border border-dashed border-border-default bg-surface-raised px-6 py-12">
      <Icon name="image" size={28} color={BRAND} />
      <Text className="font-display text-lg text-content-primary">Sign in to search by image</Text>
      <Text className="max-w-xs text-center text-sm text-content-secondary">
        Matching your inspiration needs an account. It&rsquo;s free — your image is analyzed on the
        fly and never stored.
      </Text>
      <Pressable
        onPress={() => router.push("/auth")}
        className="flex-row items-center gap-1.5 rounded-lg bg-brand px-4 py-2"
      >
        <Text className="text-sm font-semibold text-brand-on">Sign in</Text>
      </Pressable>
    </View>
  );
}

function NoEndpointState() {
  const { colors } = useTheme();
  return (
    <View className="items-center gap-3 rounded-sm border border-dashed border-border-default bg-surface-raised px-6 py-12">
      <Icon name="sparkles" size={28} color={colors.text.muted} />
      <Text className="font-display text-lg text-content-primary">
        Image search runs on the web app for now
      </Text>
      <Text className="max-w-xs text-center text-sm text-content-secondary">
        The mobile connection to image matching isn&rsquo;t configured in this build. Open getinkd
        on the web to search by image, or browse artists by style here.
      </Text>
      <Pressable
        onPress={() => router.push("/(tabs)/discover")}
        className="flex-row items-center gap-1.5 rounded-lg bg-brand px-4 py-2"
      >
        <Icon name="compass" size={15} color="#FFFFFF" />
        <Text className="text-sm font-semibold text-brand-on">Browse by style</Text>
      </Pressable>
    </View>
  );
}

function DetectedTagsPanel({ summary }: { summary: InspirationSummary }) {
  return (
    <View className="gap-3 rounded-sm border border-border-subtle bg-surface-raised p-4">
      <View className="flex-row items-center gap-2">
        <Icon name="sparkles" size={15} color="#F0662E" />
        <Text className="font-display text-sm text-content-primary">Here&rsquo;s what INKD saw</Text>
      </View>

      {summary.styles.length > 0 ? (
        <View className="flex-row flex-wrap gap-1.5">
          {summary.styles.map((s) => (
            <View
              key={s.slug}
              className="flex-row items-center gap-1.5 rounded-sm border border-brand bg-brand px-2.5 py-1"
            >
              <Text className="text-xs font-semibold text-brand-on">{s.label}</Text>
              <Text className="font-mono text-[10px] text-brand-on/70">
                {Math.round(s.confidence * 100)}%
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Text className="text-xs text-content-secondary">
          No distinct tattoo style stood out in this image.
        </Text>
      )}

      <View className="flex-row flex-wrap gap-1.5">
        <AttrChip label={summary.colorLabel} />
        {summary.placement.slice(0, 3).map((p) => (
          <AttrChip key={p} label={titleCase(p)} />
        ))}
        {summary.sizeEstimate !== "unknown" ? (
          <AttrChip label={`${titleCase(summary.sizeEstimate)} scale`} />
        ) : null}
        {summary.subjects.slice(0, 4).map((s) => (
          <AttrChip key={s} label={titleCase(s)} subtle />
        ))}
      </View>
    </View>
  );
}

function AttrChip({ label, subtle }: { label: string; subtle?: boolean }) {
  return (
    <View
      className={
        subtle
          ? "rounded-sm bg-surface-overlay px-2 py-0.5"
          : "rounded-sm border border-border-subtle bg-surface-base px-2 py-0.5"
      }
    >
      <Text className={subtle ? "text-xs text-content-muted" : "text-xs text-content-secondary"}>
        {label}
      </Text>
    </View>
  );
}

function MatchResults({
  outcome,
  groups,
  summary,
  onTryAnother,
}: {
  outcome: MatchOutcome;
  groups: MatchArtistGroup[];
  summary: InspirationSummary;
  onTryAnother: () => void;
}) {
  if (outcome === "no_style") {
    return (
      <Fallback
        icon="search"
        title="We couldn't read a clear style"
        body="This image didn't show a distinct tattoo aesthetic we could match on. Try a clearer photo of a tattoo, or browse artists by style."
      >
        <View className="flex-row flex-wrap justify-center gap-2">
          <RetryButton onPress={onTryAnother} />
          <BrowseButton />
        </View>
      </Fallback>
    );
  }

  if (outcome === "no_match") {
    return (
      <Fallback
        icon="sparkles"
        title="No artists match this vibe yet"
        body={`We read this as ${
          summary.styles
            .slice(0, 2)
            .map((s) => s.label)
            .join(" + ") || "a distinct style"
        }, but no artist in your area has work like it right now. Browse the closest styles instead.`}
      >
        <View className="flex-row flex-wrap justify-center gap-2">
          <BrowseButton label="Browse these styles" />
          <RetryButton onPress={onTryAnother} />
        </View>
      </Fallback>
    );
  }

  return (
    <View className="gap-3">
      <View className="flex-row items-baseline justify-between gap-2">
        <Text className="font-mono text-xs uppercase tracking-wider text-content-secondary">
          {groups.length} {groups.length === 1 ? "artist" : "artists"} match your inspiration
        </Text>
        {outcome === "low_match" ? (
          <Text className="font-mono text-[10px] uppercase tracking-widest text-content-muted">
            Closest we found
          </Text>
        ) : null}
      </View>

      {outcome === "low_match" ? (
        <Text className="rounded-sm border border-border-subtle bg-surface-overlay px-3 py-2 text-xs text-content-secondary">
          These are the nearest matches — none is a strong hit. Browse by style or try a different
          image.
        </Text>
      ) : null}

      <View className="gap-3">
        {groups.map((g) => (
          <MatchArtistCardMobile key={g.artistId} group={g} />
        ))}
      </View>
    </View>
  );
}

function Fallback({
  icon,
  title,
  body,
  children,
}: {
  icon: "search" | "sparkles";
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View className="items-center gap-3 rounded-sm border border-dashed border-border-default bg-surface-raised px-6 py-12">
      <Icon name={icon} size={30} color={colors.text.muted} />
      <Text className="font-display text-lg text-content-primary">{title}</Text>
      <Text className="max-w-xs text-center text-sm text-content-secondary">{body}</Text>
      {children}
    </View>
  );
}

function RetryButton({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-1.5 rounded-lg border border-border-strong px-4 py-2"
    >
      <Icon name="image" size={15} color={colors.text.primary} />
      <Text className="text-sm font-semibold text-content-primary">Try another image</Text>
    </Pressable>
  );
}

function BrowseButton({ label = "Browse by style" }: { label?: string }) {
  return (
    <Pressable
      onPress={() => router.push("/(tabs)/discover")}
      className="flex-row items-center gap-1.5 rounded-lg bg-brand px-4 py-2"
    >
      <Icon name="compass" size={15} color="#FFFFFF" />
      <Text className="text-sm font-semibold text-brand-on">{label}</Text>
    </Pressable>
  );
}

function MatchArtistCardMobile({ group }: { group: MatchArtistGroup }) {
  const { colors } = useTheme();
  const tone =
    group.topSimilarity >= STRONG_MATCH_THRESHOLD
      ? "text-content-ember"
      : group.topSimilarity >= CLOSE_MATCH_THRESHOLD
        ? "text-content-primary"
        : "text-content-secondary";

  return (
    <Pressable
      onPress={() => (group.handle ? router.push(`/artist/${group.handle}`) : undefined)}
      disabled={!group.handle}
      className="overflow-hidden rounded-sm border border-border-subtle bg-surface-raised active:border-border-strong"
    >
      <View className="flex-row items-start gap-3 p-4 pb-3">
        <Avatar src={group.avatarUrl ?? undefined} name={group.displayName} size="lg" shape="square" />
        <View className="min-w-0 flex-1">
          <Text className="truncate font-display text-lg text-content-primary" numberOfLines={1}>
            {group.displayName}
          </Text>
          {group.handle ? (
            <Text className="font-mono text-xs text-content-muted" numberOfLines={1}>
              @{group.handle}
            </Text>
          ) : null}
          <View className="mt-1 flex-row items-center gap-1.5">
            <Icon name="sparkles" size={13} color="#F0662E" />
            <Text className="flex-1 text-sm text-content-secondary" numberOfLines={1}>
              {group.matchReason}
            </Text>
          </View>
        </View>
        <View className="items-end">
          <Text className={`font-hand text-2xl leading-none ${tone}`}>
            {group.topSimilarityPercent}%
          </Text>
          <Text className="mt-0.5 font-mono text-[9px] font-bold uppercase tracking-widest text-content-muted">
            {group.matchLabel}
          </Text>
        </View>
      </View>

      {group.works.length > 0 ? (
        <View className="flex-row flex-wrap gap-0.5 px-0.5 pb-0.5">
          {group.works.map((w) => (
            <WorkThumb key={w.subjectId} work={w} />
          ))}
        </View>
      ) : null}

      {group.handle ? (
        <View className="flex-row items-center justify-between px-4 py-2.5">
          <Text className="font-mono text-[11px] font-semibold uppercase tracking-widest text-content-secondary">
            View portfolio
          </Text>
          <Icon name="arrow-right" size={14} color={colors.text.muted} />
        </View>
      ) : null}
    </Pressable>
  );
}

function WorkThumb({ work }: { work: MatchWork }) {
  const { colors } = useTheme();
  return (
    <View className="relative aspect-square w-[24%] overflow-hidden bg-surface-overlay">
      {work.imageUrl ? (
        <Image source={{ uri: work.imageUrl }} className="h-full w-full" resizeMode="cover" />
      ) : (
        <View className="h-full w-full items-center justify-center">
          <Icon name="image" size={16} color={colors.text.muted} />
        </View>
      )}
      <View className="absolute bottom-1 right-1 rounded-sm bg-surface-base/85 px-1 py-0.5">
        <Text className="font-mono text-[9px] font-bold tabular-nums text-content-primary">
          {work.similarityPercent}%
        </Text>
      </View>
    </View>
  );
}

function SaveStub() {
  const { colors } = useTheme();
  return (
    <View className="flex-row items-center justify-between gap-3 rounded-sm border border-border-subtle bg-surface-overlay px-4 py-3">
      <Text className="flex-1 text-xs text-content-secondary">
        Want to come back to these artists? Save this inspiration to a board.
      </Text>
      <Pressable
        onPress={() =>
          Alert.alert("Coming soon", "Saved inspiration boards land in a later update.")
        }
        className="flex-row shrink-0 items-center gap-1.5 rounded-lg border border-border-strong px-3 py-1.5"
      >
        <Icon name="plus" size={13} color={colors.text.primary} />
        <Text className="text-xs font-semibold text-content-primary">Save</Text>
        <Text className="font-mono text-[9px] uppercase tracking-widest text-content-muted">
          Soon
        </Text>
      </Pressable>
    </View>
  );
}
