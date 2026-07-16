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
  Spinner,
  Tabs,
  ToastProvider,
} from "@inkd/ui/native";
import { useCurrentProfile, useCurrentArtistProfile } from "@inkd/core/hooks";
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
    <ToastProvider>
      <SettingsView />
    </ToastProvider>
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
    </View>
  );
}
