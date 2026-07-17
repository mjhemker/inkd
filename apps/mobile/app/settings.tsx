/**
 * Artist settings — tabbed editor mirroring the web settings-view.tsx.
 * Reuses the same shared editors as onboarding.tsx (components/artist/*),
 * each rendered in `variant="settings"` so they show their own Save button
 * instead of deferring to a parent Continue flow.
 */
import { useState, type ReactNode } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Icon,
  Input,
  Modal,
  Spinner,
  Tabs,
  ToastProvider,
  Toggle,
  useToast,
} from "@inkd/ui/native";
import {
  useCurrentProfile,
  useCurrentArtistProfile,
  useDowngradeToClient,
  useMyShop,
  useUpdateArtistProfile,
} from "@inkd/core/hooks";
import type { ArtistProfile } from "@inkd/core";
import {
  AgentAutonomyEditor,
  BookingEditor,
  ConnectedAccountsEditor,
  IdentityEditor,
  LocationsEditor,
  PlanCard,
  ServicesEditor,
  ShareKit,
} from "@/components/artist";

import { ScreenHeader } from "@/components/ScreenHeader";
import { ArtistOnly } from "@/components/ArtistOnly";
import { AppearanceControl } from "@/components/AppearanceControl";
import { NotificationPreferencesEditor } from "@/components/notifications/NotificationPreferencesEditor";
import { ShopSettingsSection } from "@/components/shop/ShopSettingsSection";
import { useSession } from "@/providers/session";
import { useTheme } from "@/providers/theme";

/**
 * Grouped settings tabs, mirroring the web settings-view.tsx: related editors
 * merge into one tab and render as stacked sections with placard headers.
 * Profile · Studio (Locations · Hours & booking · Services · Waivers) ·
 * AI staff · Shop (owners only) · Sharing · Preferences (Notifications ·
 * Appearance) · Account.
 */
const TAB_DEFS: { value: string; label: string; ownerOnly?: boolean }[] = [
  { value: "profile", label: "Profile" },
  { value: "studio", label: "Studio" },
  { value: "ai", label: "AI staff" },
  { value: "shop", label: "Shop", ownerOnly: true },
  { value: "sharing", label: "Sharing" },
  { value: "preferences", label: "Preferences" },
  { value: "account", label: "Account" },
];

/** Old `?tab=` keys (and new keys) → the grouped tab they now live on. Keeps
 * cross-links and notification deep-links landing on the right tab. */
const TAB_ROUTE: Record<string, string> = {
  profile: "profile",
  studio: "studio",
  ai: "ai",
  shop: "shop",
  sharing: "sharing",
  preferences: "preferences",
  account: "account",
  locations: "studio",
  booking: "studio",
  services: "studio",
  waivers: "studio",
  grow: "sharing",
  notifications: "preferences",
  appearance: "preferences",
};

export default function SettingsScreen() {
  return (
    <ArtistOnly>
      <ToastProvider>
        <SettingsView />
      </ToastProvider>
    </ArtistOnly>
  );
}

function SettingsView() {
  const { colors } = useTheme();
  const router = useRouter();
  // Honour the ?tab= deep link (from notifications / cross-links), mirroring
  // web settings-view.tsx which reads searchParams.get("tab").
  const params = useLocalSearchParams<{ tab?: string }>();
  const { data: profile, isLoading: pLoading } = useCurrentProfile();
  const { data: artist, isLoading: aLoading } = useCurrentArtistProfile();
  const { data: shop } = useMyShop();
  const initialTab = TAB_ROUTE[params.tab ?? ""] ?? "profile";
  const [tab, setTab] = useState(initialTab);

  // Shop tab is owners-only.
  const tabs = TAB_DEFS.filter((t) => !t.ownerOnly || Boolean(shop));

  if (pLoading || aLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-surface-base">
        <Spinner size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-base" edges={["top", "bottom"]}>
      <ScrollView className="flex-1" contentContainerClassName="gap-6 px-6 py-6">
        <ScreenHeader
          eyebrow="Settings"
          title="Studio settings"
          subtitle="Manage everything clients see and how your books run."
        />

        {!profile ? (
          <Text className="text-content-secondary">
            We couldn&apos;t load your account. Try refreshing.
          </Text>
        ) : !artist ? (
          <Card padding="lg" className="items-start gap-4">
            <View className="h-12 w-12 items-center justify-center rounded-xl bg-surface-overlay">
              <Icon name="sparkles" size={22} color={colors.text.accent} />
            </View>
            <View className="gap-1.5">
              <Text className="font-display text-xl text-content-primary">
                Set up your artist profile
              </Text>
              <Text className="max-w-md text-content-secondary">
                Finish onboarding to manage your studio, hours, services and AI staff here.
              </Text>
            </View>
            <Button onPress={() => router.push("/onboarding")}>
              Start setup
              <Icon name="arrow-right" size={16} color={colors.text.primary} />
            </Button>
          </Card>
        ) : (
          <>
            <Tabs value={tab} onValueChange={setTab} items={tabs} />

            <View>
              {tab === "profile" && (
                <IdentityEditor profile={profile} artist={artist} variant="settings" />
              )}

              {tab === "studio" && (
                <View className="gap-10">
                  <SettingsSection
                    eyebrow="Studio"
                    title="Locations"
                    description="Where you tattoo — studios, private suites, and travel options."
                  >
                    <LocationsEditor artist={artist} variant="settings" />
                  </SettingsSection>
                  <SettingsSection
                    eyebrow="Studio"
                    title="Hours & booking"
                    description="Business days, vacation blocks, booking window, and aftercare."
                  >
                    <View className="gap-6">
                      <BookingEditor artist={artist} variant="settings" />
                      <AftercareSettingsCard artist={artist} />
                    </View>
                  </SettingsSection>
                  <SettingsSection
                    eyebrow="Studio"
                    title="Services"
                    description="What clients can book, with rates, durations, and add-ons."
                  >
                    <ServicesEditor artistId={artist.id} variant="settings" />
                  </SettingsSection>
                  <SettingsSection
                    eyebrow="Studio"
                    title="Waivers"
                    description="MD/PA consent forms and signed-waiver records."
                  >
                    <View className="gap-4 rounded-xl border border-border-subtle p-5">
                      <Text className="text-sm text-content-secondary">
                        Manage your MD/PA consent forms, edit template content,
                        and review signed waivers from clients.
                      </Text>
                      <Button
                        onPress={() => router.push("/waivers")}
                        className="self-start"
                      >
                        Manage waivers
                        <Icon name="arrow-right" size={16} color={colors.text.primary} />
                      </Button>
                    </View>
                  </SettingsSection>
                </View>
              )}

              {tab === "ai" && (
                <View className="gap-5">
                  <Card
                    padding="md"
                    variant="interactive"
                    onPress={() => router.push("/studio/ai")}
                    className="flex-row items-center justify-between"
                  >
                    <View className="flex-row items-center gap-3">
                      <View className="h-9 w-9 items-center justify-center rounded-sm bg-surface-ember">
                        <Icon name="sparkles" size={17} color="#0A0A0B" />
                      </View>
                      <View>
                        <Text className="text-sm font-sans-semibold text-content-primary">
                          Your AI staff area
                        </Text>
                        <Text className="text-xs text-content-muted">
                          Approvals, activity ledger, and playbook
                        </Text>
                      </View>
                    </View>
                    <Icon name="arrow-right" size={16} color={colors.text.muted} />
                  </Card>
                  <AgentAutonomyEditor artist={artist} variant="settings" />
                </View>
              )}

              {tab === "shop" && <ShopSettingsSection />}

              {tab === "sharing" && (
                <View className="gap-10">
                  <ShareKit profile={profile} />
                  <ConnectedAccountsEditor artist={artist} />
                </View>
              )}

              {tab === "preferences" && (
                <View className="gap-10">
                  <SettingsSection
                    eyebrow="Preferences"
                    title="Notifications"
                    description="Choose what INKD tells you about, and where."
                  >
                    <NotificationPreferencesEditor />
                  </SettingsSection>
                  <SettingsSection
                    eyebrow="Preferences"
                    title="Appearance"
                    description="How INKD looks on this device."
                  >
                    <View className="gap-4 rounded-xl border border-border-subtle p-5">
                      <Text className="text-sm text-content-secondary">
                        Dark is the gallery default; Light is a warm paper wall.
                        System follows your device.
                      </Text>
                      <AppearanceControl />
                      <Text className="font-mono text-xs uppercase tracking-widest text-content-muted">
                        Saved on this device
                      </Text>
                    </View>
                  </SettingsSection>
                </View>
              )}

              {tab === "account" && (
                <AccountPanel
                  profileName={profile.display_name}
                  avatarUrl={profile.avatar_url}
                  handle={profile.handle}
                  published={artist.is_published}
                />
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/** Placard section header + its editor, used inside merged settings tabs so
 * the grouped Studio / Preferences tabs read as clean stacked sections. */
function SettingsSection({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <View className="gap-4">
      <View className="gap-1 border-l-2 border-brand bg-surface-raised px-4 py-3">
        <Text className="font-mono text-[11px] uppercase tracking-widest text-content-muted">
          {eyebrow}
        </Text>
        <Text className="font-display text-lg text-content-primary">{title}</Text>
        {description ? (
          <Text className="text-sm text-content-secondary">{description}</Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/** Artist toggle for the aftercare healing timeline. Always-on by default;
 * flipping it off stops new completed sessions from scheduling check-ins.
 * Mirrors apps/web/src/components/aftercare/aftercare-settings-card.tsx. */
function AftercareSettingsCard({ artist }: { artist: ArtistProfile }) {
  const update = useUpdateArtistProfile(artist.id);
  const enabled = artist.aftercare_enabled ?? true;

  return (
    <Card padding="lg" className="flex-row items-start justify-between gap-4">
      <View className="flex-1 flex-row items-start gap-3">
        <View className="mt-0.5 h-9 w-9 items-center justify-center rounded-sm bg-surface-ember">
          <Icon name="sparkles" size={17} color="#0A0A0B" />
        </View>
        <View className="flex-1 gap-1">
          <Text className="text-sm font-sans-semibold text-content-primary">
            Aftercare check-ins
          </Text>
          <Text className="text-sm text-content-secondary">
            Automatically check in with clients at 3 days, 1 week, and 3 weeks after a completed
            session — how it&apos;s healing, an optional photo, and (with their consent) a healed
            photo for your portfolio.
          </Text>
        </View>
      </View>
      <View className="flex-row items-center gap-2">
        {update.isPending && <Spinner size="small" />}
        <Toggle
          checked={enabled}
          onCheckedChange={(v) => update.mutate({ aftercare_enabled: v })}
          disabled={update.isPending}
        />
      </View>
    </Card>
  );
}

function AccountPanel({
  profileName,
  avatarUrl,
  handle,
  published,
}: {
  profileName: string | null;
  avatarUrl: string | null;
  handle: string | null;
  published: boolean;
}) {
  const { colors } = useTheme();
  const router = useRouter();
  const { signOut } = useSession();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
      router.replace("/auth");
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <View className="gap-6">
      <Card padding="md" className="flex-row items-center gap-4">
        <Avatar src={avatarUrl ?? undefined} name={profileName ?? "You"} size="lg" />
        <View className="flex-1">
          <Text className="text-base font-sans-semibold text-content-primary">
            {profileName ?? "Your account"}
          </Text>
          <Text className="font-mono text-sm text-content-muted">@{handle ?? "—"}</Text>
        </View>
        <Badge variant={published ? "success" : "neutral"}>
          {published ? "Published" : "Draft"}
        </Badge>
      </Card>

      <PlanCard />

      <View className="gap-3 rounded-xl border border-border-subtle p-5">
        <Text className="text-sm font-sans-medium text-content-primary">Session</Text>
        <Text className="text-sm text-content-secondary">
          Sign out on this device. You can always sign back in with your email.
        </Text>
        <Button
          variant="outline"
          onPress={() => void handleSignOut()}
          loading={signingOut}
          className="self-start"
        >
          <Icon name="arrow-right" size={16} color={colors.text.primary} />
          Sign out
        </Button>
      </View>

      <SwitchToClientCard />

      <DangerZoneCard />
    </View>
  );
}

/** Artist → client downgrade (no self-serve client → artist path). */
function SwitchToClientCard() {
  const router = useRouter();
  const { toast } = useToast();
  const downgrade = useDowngradeToClient();
  const [open, setOpen] = useState(false);

  async function handleDowngrade() {
    try {
      await downgrade.mutateAsync();
      setOpen(false);
      toast({ title: "Switched to a client account", variant: "success" });
      router.replace("/(tabs)");
    } catch (err) {
      toast({
        title: "Couldn't switch account",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "danger",
      });
    }
  }

  return (
    <View className="gap-3 rounded-xl border border-border-subtle p-5">
      <Text className="text-sm font-sans-medium text-content-primary">
        Switch to a client account
      </Text>
      <Text className="text-sm text-content-secondary">
        Step back from being an artist and use INKD to get tattooed. Your studio
        stays intact — nothing is deleted.
      </Text>
      <Button variant="outline" className="self-start" onPress={() => setOpen(true)}>
        Switch to client account
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Switch to a client account?"
        description="Here's exactly what happens:"
        footer={
          <View className="flex-row justify-end gap-2">
            <Button variant="ghost" onPress={() => setOpen(false)} disabled={downgrade.isPending}>
              Cancel
            </Button>
            <Button variant="outline" onPress={() => void handleDowngrade()} loading={downgrade.isPending}>
              Switch to client
            </Button>
          </View>
        }
      >
        <View className="gap-2">
          <Text className="text-sm text-content-secondary">
            • Your public profile is unpublished and no longer discoverable.
          </Text>
          <Text className="text-sm text-content-secondary">
            • Your bookings, portfolio and signed waivers are kept but frozen —
            never deleted.
          </Text>
          <Text className="text-sm text-content-secondary">
            • Your navigation switches to the client experience.
          </Text>
          <Text className="text-sm text-content-muted">
            Becoming an artist again is invite/setup-based during the pilot —
            reach out and we&apos;ll switch you back.
          </Text>
        </View>
      </Modal>
    </View>
  );
}

/** Danger zone: permanent account deletion behind a typed confirmation. */
function DangerZoneCard() {
  const router = useRouter();
  const { toast } = useToast();
  const { supabase, signOut } = useSession();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      const { error } = await supabase.functions.invoke("delete-account", {
        method: "POST",
      });
      if (error) throw error;
      await signOut();
      router.replace("/auth");
    } catch (err) {
      setDeleting(false);
      toast({
        title: "Couldn't delete account",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "danger",
      });
    }
  }

  return (
    <View className="gap-3 rounded-xl border border-danger-500/40 bg-danger-500/5 p-5">
      <Text className="text-sm font-sans-medium text-danger-500">Danger zone</Text>
      <Text className="text-sm text-content-secondary">
        Permanently delete your INKD account and all of your data. This cannot be
        undone.
      </Text>
      <Button
        variant="outline"
        className="self-start border-danger-500/50"
        onPress={() => {
          setConfirmText("");
          setOpen(true);
        }}
      >
        <Icon name="alert-triangle" size={16} color="#F87171" />
        Delete account
      </Button>

      <Modal
        open={open}
        onClose={() => (deleting ? undefined : setOpen(false))}
        title="Delete your account?"
        description="This permanently removes your account, profile, and studio data. This cannot be undone."
        footer={
          <View className="flex-row justify-end gap-2">
            <Button variant="ghost" onPress={() => setOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="outline"
              className="border-danger-500/50"
              disabled={confirmText !== "DELETE"}
              loading={deleting}
              onPress={() => void handleDelete()}
            >
              Delete account
            </Button>
          </View>
        }
      >
        <View className="gap-2">
          <Text className="text-sm text-content-secondary">
            Type DELETE to confirm.
          </Text>
          <Input
            value={confirmText}
            onChangeText={setConfirmText}
            placeholder="DELETE"
            autoCapitalize="characters"
            autoCorrect={false}
          />
        </View>
      </Modal>
    </View>
  );
}
