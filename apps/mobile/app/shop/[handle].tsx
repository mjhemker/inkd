/**
 * Public shop page (mobile mirror of apps/web/src/app/s/[handle]). A shop is
 * an artist account that hosts other artists — this shows its hero, active
 * roster (owner excluded — they're the host, not a listing), and public
 * studio locations. Mirrors apps/mobile/app/artist/[handle].tsx structurally.
 */
import { router, useLocalSearchParams } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Avatar, Badge, Card, Icon, Skeleton } from "@inkd/ui/native";
import {
  shopModeLabel,
  shopRoleLabel,
  useActiveShopMembers,
  useShopByHandle,
  useStudioLocations,
  type ShopRosterMember,
} from "@inkd/core";

import { classificationLabel } from "@/lib/format";
import { useTheme } from "@/providers/theme";
import { BackButton } from "@/components/BackButton";

export default function ShopProfileScreen() {
  const { colors } = useTheme();
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const { data: shop, isLoading } = useShopByHandle(handle);
  const { data: members } = useActiveShopMembers(shop?.id);
  const { data: locations } = useStudioLocations(shop?.owner_artist_id);

  const roster = (members ?? []).filter((m) => m.role !== "owner");
  const owner = (members ?? []).find((m) => m.role === "owner");
  const ownerProfile = owner?.artist?.profile;
  const publicLocations = (locations ?? []).filter((l) => l.is_public);
  const primaryLocation =
    publicLocations.find((l) => l.id === shop?.primary_location_id) ??
    publicLocations.find((l) => l.is_primary) ??
    publicLocations[0];

  return (
    <SafeAreaView className="flex-1 bg-surface-base" edges={["top", "bottom"]}>
      <View className="flex-row items-center gap-2 px-4 py-2">
        <BackButton fallback="/(tabs)/discover" />
        <Text className="font-mono text-xs uppercase tracking-[0.18em] text-content-muted">
          {handle ? `@${handle}` : "Shop"}
        </Text>
      </View>

      {isLoading ? (
        <View className="gap-4 px-6 py-4">
          <Skeleton className="h-20 w-20 rounded-xl" />
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </View>
      ) : !shop ? (
        <View className="flex-1 items-center justify-center gap-2 px-6">
          <Icon name="layout-grid" size={28} color={colors.text.muted} />
          <Text className="font-display text-lg text-content-primary">Shop not found</Text>
          <Text className="text-center text-sm text-content-muted">
            This shop isn&apos;t published yet, or the handle is wrong.
          </Text>
        </View>
      ) : (
        <ScrollView className="flex-1" contentContainerClassName="gap-6 px-6 pb-10 pt-2">
          <View className="gap-4">
            <View className="flex-row items-end gap-4">
              <Avatar src={shop.avatar_url ?? undefined} name={shop.name} size="xl" shape="square" />
              <View className="flex-1 gap-1">
                <Text className="font-display text-2xl text-content-primary">{shop.name}</Text>
                <Text className="font-mono text-sm text-content-muted">@{shop.handle}</Text>
              </View>
            </View>

            <View className="flex-row flex-wrap gap-1.5">
              <Badge variant="ember" size="sm">
                <Icon name="layout-grid" size={12} color="#0A0A0B" />
                <Text className="ml-1 font-sans-semibold text-xs text-brand-on-ember">Shop</Text>
              </Badge>
              {primaryLocation && (
                <Badge variant="outline" size="sm">
                  {[primaryLocation.city, primaryLocation.state].filter(Boolean).join(", ")}
                </Badge>
              )}
              <Badge variant="outline" size="sm">
                {roster.length} {roster.length === 1 ? "artist" : "artists"}
              </Badge>
            </View>

            {shop.bio && <Text className="text-sm text-content-secondary">{shop.bio}</Text>}
          </View>

          <View className="gap-3">
            <View className="gap-1">
              <Text className="font-display text-lg text-content-primary">
                The {shop.name} roster
              </Text>
              {ownerProfile && (
                <Text className="text-sm text-content-secondary">
                  Hosted by{" "}
                  <Text
                    onPress={() =>
                      ownerProfile.handle &&
                      router.push(`/artist/${ownerProfile.handle}` as never)
                    }
                    className="font-sans-semibold text-content-accent"
                  >
                    {ownerProfile.display_name || `@${ownerProfile.handle}`}
                  </Text>
                </Text>
              )}
            </View>
            {roster.length === 0 ? (
              <Card padding="lg" className="items-center gap-2">
                <Icon name="user" size={22} color={colors.text.muted} />
                <Text className="text-center text-sm text-content-muted">
                  This shop hasn&apos;t added any artists to its roster yet.
                </Text>
              </Card>
            ) : (
              <View className="gap-3">
                {roster.map((member) => (
                  <MemberCard key={member.id} member={member} />
                ))}
              </View>
            )}
          </View>

          {publicLocations.length > 0 && (
            <View className="gap-3">
              <Text className="font-display text-lg text-content-primary">Where to find us</Text>
              <View className="gap-3">
                {publicLocations.map((location) => (
                  <Card key={location.id} padding="md" className="gap-1">
                    <View className="flex-row items-center gap-2">
                      <Icon name="map-pin" size={15} color={colors.text.accent} />
                      <Text className="text-sm font-semibold text-content-primary">
                        {location.name || "Studio"}
                      </Text>
                    </View>
                    <Text className="text-sm text-content-secondary">
                      {[location.address_line1, location.city, location.state, location.postal_code]
                        .filter(Boolean)
                        .join(", ")}
                    </Text>
                  </Card>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function MemberCard({ member }: { member: ShopRosterMember }) {
  const { colors } = useTheme();
  const profile = member.artist?.profile;
  const name = profile?.display_name || (profile?.handle ? `@${profile.handle}` : "Artist");

  return (
    <Card
      padding="md"
      variant="interactive"
      onPress={() => profile?.handle && router.push(`/artist/${profile.handle}` as never)}
      className="gap-3"
    >
      <View className="flex-row items-center gap-3">
        <Avatar src={profile?.avatar_url ?? undefined} name={name} size="md" />
        <View className="flex-1 gap-0.5">
          <Text className="text-sm font-sans-semibold text-content-primary">{name}</Text>
          {profile?.handle && (
            <Text className="font-mono text-xs text-content-muted">@{profile.handle}</Text>
          )}
        </View>
        <Icon name="chevron-right" size={16} color={colors.text.muted} />
      </View>
      <View className="flex-row flex-wrap gap-1.5">
        <Badge variant="neutral" size="sm">
          {shopRoleLabel(member.role)}
        </Badge>
        <Badge variant={member.membership_mode === "managed" ? "brand" : "outline"} size="sm">
          {shopModeLabel(member.membership_mode)}
        </Badge>
        {member.artist?.classification && (
          <Badge variant="outline" size="sm">
            {classificationLabel(member.artist.classification)}
          </Badge>
        )}
      </View>
    </Card>
  );
}
