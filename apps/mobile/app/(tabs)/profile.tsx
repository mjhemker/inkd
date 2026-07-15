import { useState } from "react";
import { router } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Icon,
  Skeleton,
  Tabs,
  ToastProvider,
  type TabItem,
} from "@inkd/ui/native";
import { useCurrentArtistProfile, useCurrentProfile } from "@inkd/core";

import { ScreenHeader } from "@/components/ScreenHeader";
import { NotificationBellButton } from "@/components/notifications/NotificationBellButton";
import { EditProfileSheet } from "@/components/profile/EditProfileSheet";
import { PostsPanel } from "@/components/profile/PostsPanel";
import { PortfolioPanel } from "@/components/profile/PortfolioPanel";
import { FlashPanel } from "@/components/profile/FlashPanel";
import { classificationLabel, travelBadges } from "@/lib/format";

const TABS: TabItem[] = [
  { value: "portfolio", label: "Portfolio" },
  { value: "posts", label: "Posts" },
  { value: "flash", label: "Flash" },
];

export default function ProfileScreen() {
  return (
    <ToastProvider>
      <ProfileScreenContent />
    </ToastProvider>
  );
}

function ProfileScreenContent() {
  const { data: profile, isLoading: profileLoading } = useCurrentProfile();
  const { data: artist, isLoading: artistLoading } = useCurrentArtistProfile();
  const [editOpen, setEditOpen] = useState(false);
  const [tab, setTab] = useState("portfolio");

  if (profileLoading || artistLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface-base" edges={["top", "bottom"]}>
        <View className="gap-4 px-6 py-8">
          <Skeleton className="h-20 w-20 rounded-full" />
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView className="flex-1 bg-surface-base" edges={["top", "bottom"]}>
        <ScrollView className="flex-1" contentContainerClassName="gap-8 px-6 py-8">
          <ScreenHeader eyebrow="PROFILE" title="Profile" subtitle="Sign in to manage your profile." />
          <EmptyState
            icon={<Icon name="user" size={32} color="#71717A" />}
            title="Sign in to continue"
            description="Your profile — portfolio, posts, and flash — lives here once you're signed in."
            action={
              <Button size="md" onPress={() => router.push("/auth")}>
                Sign in
              </Button>
            }
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  const isArtist = Boolean(artist);

  return (
    <SafeAreaView className="flex-1 bg-surface-base" edges={["top", "bottom"]}>
      <ScrollView className="flex-1" contentContainerClassName="gap-6 px-6 py-8">
        <ScreenHeader
          eyebrow="PROFILE"
          title="Your profile"
          subtitle={isArtist ? "Manage your portfolio, posts, and flash." : "Your public presence on INKD."}
          action={<NotificationBellButton />}
        />

        <Card className="gap-4">
          <View className="flex-row items-start gap-4">
            <Avatar
              src={profile.avatar_url ?? undefined}
              name={profile.display_name ?? profile.handle ?? "You"}
              size="lg"
            />
            <View className="flex-1 gap-1">
              <View className="flex-row flex-wrap items-center gap-2">
                <Text className="font-display text-xl text-content-primary">
                  {profile.display_name || "Add your name"}
                </Text>
                {isArtist && (
                  <Badge variant={artist?.is_published ? "success" : "outline"} size="sm">
                    {artist?.is_published ? "Published" : "Unpublished"}
                  </Badge>
                )}
              </View>
              {profile.handle && (
                <Text className="font-mono text-sm text-content-muted">@{profile.handle}</Text>
              )}
              {isArtist && artist?.tagline && (
                <Text className="text-sm text-content-secondary">{artist.tagline}</Text>
              )}
            </View>
          </View>

          {isArtist && artist && (
            <View className="flex-row flex-wrap gap-1.5">
              <Badge variant="outline" size="sm">
                {classificationLabel(artist.classification)}
              </Badge>
              {travelBadges(artist).map((label) => (
                <Badge key={label} variant="outline" size="sm">
                  {label}
                </Badge>
              ))}
            </View>
          )}

          <View className="flex-row gap-2">
            {isArtist && artist?.is_published && profile.handle && (
              <Button
                variant="secondary"
                size="sm"
                className="flex-1"
                onPress={() => router.push(`/artist/${profile.handle}`)}
              >
                View public profile
              </Button>
            )}
            <Button variant="secondary" size="sm" className="flex-1" onPress={() => setEditOpen(true)}>
              Edit profile
            </Button>
          </View>
        </Card>

        {isArtist && artist ? (
          <View className="gap-4">
            <Tabs value={tab} onValueChange={setTab} items={TABS} />
            {tab === "portfolio" && <PortfolioPanel artistId={artist.id} userId={profile.id} />}
            {tab === "posts" && <PostsPanel artistId={artist.id} userId={profile.id} />}
            {tab === "flash" && <FlashPanel artistId={artist.id} userId={profile.id} />}
          </View>
        ) : (
          <EmptyState
            icon={<Icon name="sparkles" size={28} color="#71717A" />}
            title="Set up your artist tools"
            description="Turn on your studio to publish a portfolio, post flash, and open bookings."
            action={
              <Button size="md" onPress={() => router.push("/onboarding")}>
                Become an artist
              </Button>
            }
          />
        )}
      </ScrollView>

      <EditProfileSheet open={editOpen} onClose={() => setEditOpen(false)} profile={profile} artist={artist ?? null} />
    </SafeAreaView>
  );
}
