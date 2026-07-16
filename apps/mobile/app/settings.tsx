/**
 * Artist settings — tabbed editor mirroring the web settings-view.tsx.
 * Reuses the same shared editors as onboarding.tsx (components/artist/*),
 * each rendered in `variant="settings"` so they show their own Save button
 * instead of deferring to a parent Continue flow.
 */
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
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
  useToast,
} from "@inkd/ui/native";
import {
  useCurrentProfile,
  useCurrentArtistProfile,
  useDowngradeToClient,
} from "@inkd/core/hooks";
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
import { useSession } from "@/providers/session";

const TABS = [
  { value: "profile", label: "Profile" },
  { value: "locations", label: "Locations" },
  { value: "booking", label: "Hours & booking" },
  { value: "services", label: "Services" },
  { value: "waivers", label: "Waivers" },
  { value: "ai", label: "AI staff" },
  { value: "grow", label: "Share & connect" },
  { value: "appearance", label: "Appearance" },
  { value: "account", label: "Account" },
];

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
  const router = useRouter();
  const { data: profile, isLoading: pLoading } = useCurrentProfile();
  const { data: artist, isLoading: aLoading } = useCurrentArtistProfile();
  const [tab, setTab] = useState("profile");

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
              <Icon name="sparkles" size={22} color="#A78BFA" />
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
              <Icon name="arrow-right" size={16} color="#FAFAFA" />
            </Button>
          </Card>
        ) : (
          <>
            <Tabs value={tab} onValueChange={setTab} items={TABS} />

            <View>
              {tab === "profile" && (
                <IdentityEditor profile={profile} artist={artist} variant="settings" />
              )}
              {tab === "locations" && <LocationsEditor artist={artist} variant="settings" />}
              {tab === "booking" && <BookingEditor artist={artist} variant="settings" />}
              {tab === "services" && (
                <ServicesEditor artistId={artist.id} variant="settings" />
              )}
              {tab === "waivers" && (
                <View className="gap-4 rounded-xl border border-border-subtle p-5">
                  <Text className="text-base font-sans-semibold text-content-primary">
                    Consent &amp; waivers
                  </Text>
                  <Text className="text-sm text-content-secondary">
                    Manage your MD/PA consent forms, edit template content, and
                    review signed waivers from clients.
                  </Text>
                  <Button
                    onPress={() => router.push("/waivers")}
                    className="self-start"
                  >
                    Manage waivers
                    <Icon name="arrow-right" size={16} color="#FAFAFA" />
                  </Button>
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
                    <Icon name="arrow-right" size={16} color="#71717A" />
                  </Card>
                  <AgentAutonomyEditor artist={artist} variant="settings" />
                </View>
              )}
              {tab === "grow" && (
                <View className="gap-10">
                  <ShareKit profile={profile} />
                  <ConnectedAccountsEditor artist={artist} />
                </View>
              )}
              {tab === "appearance" && (
                <View className="gap-4 rounded-xl border border-border-subtle p-5">
                  <Text className="text-base font-sans-semibold text-content-primary">
                    Appearance
                  </Text>
                  <Text className="text-sm text-content-secondary">
                    Choose how INKD looks on this device. Dark is the gallery
                    default; Light is a warm paper wall. System follows your
                    device.
                  </Text>
                  <AppearanceControl />
                  <Text className="font-mono text-xs uppercase tracking-widest text-content-muted">
                    Saved on this device
                  </Text>
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
          <Icon name="arrow-right" size={16} color="#FAFAFA" />
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
