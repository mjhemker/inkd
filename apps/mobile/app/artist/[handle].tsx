import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Eyebrow,
  Icon,
  Skeleton,
  Tabs,
  type IconName,
  type TabItem,
} from "@inkd/ui/native";
import {
  formatRatingAvg,
  summarizeReviews,
  useArtistShopBadges,
  usePublicArtistProfile,
  type PublicArtistProfileData,
} from "@inkd/core";

import {
  bookingWindowLabel,
  classificationLabel,
  flashPriceLabel,
  hoursSummary,
  servicePriceLabel,
  travelBadges,
} from "@/lib/format";
import { ReviewsTab } from "@/components/reviews/reviews-tab";
import { useTheme } from "@/providers/theme";
import { BackButton } from "@/components/BackButton";

const TABS: TabItem[] = [
  { value: "portfolio", label: "Portfolio" },
  { value: "posts", label: "Posts" },
  { value: "flash", label: "Flash" },
  { value: "reviews", label: "Reviews" },
  { value: "info", label: "Info" },
];

export default function ArtistProfileScreen() {
  const { colors } = useTheme();
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const { data, isLoading } = usePublicArtistProfile(handle);
  const [tab, setTab] = useState("portfolio");

  return (
    <SafeAreaView className="flex-1 bg-surface-base" edges={["top", "bottom"]}>
      <View className="flex-row items-center gap-2 px-4 py-2">
        <BackButton fallback="/(tabs)/discover" />
        <Text className="font-mono text-xs uppercase tracking-[0.18em] text-content-muted">
          {handle ? `@${handle}` : "Artist"}
        </Text>
      </View>

      {isLoading ? (
        <View className="gap-4 px-6 py-4">
          <Skeleton className="h-20 w-20 rounded-full" />
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </View>
      ) : !data ? (
        <View className="flex-1 items-center justify-center gap-2 px-6">
          <Icon name="user" size={28} color={colors.text.muted} />
          <Text className="font-display text-lg text-content-primary">Profile not found</Text>
          <Text className="text-center text-sm text-content-muted">
            This artist isn&apos;t published yet, or the handle is wrong.
          </Text>
        </View>
      ) : (
        <ScrollView className="flex-1" contentContainerClassName="gap-6 px-6 pb-10 pt-2">
          <Hero data={data} />

          <Tabs value={tab} onValueChange={setTab} items={TABS} />

          {tab === "portfolio" && <PortfolioGrid data={data} />}
          {tab === "posts" && <PostsGrid data={data} />}
          {tab === "flash" && <FlashList data={data} />}
          {tab === "reviews" && (
            <ReviewsTab
              reviews={data.reviews}
              reviewerProfiles={data.reviewerProfiles}
              artistName={data.profile.display_name || data.profile.handle}
            />
          )}
          {tab === "info" && <InfoTab data={data} />}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Hero({ data }: { data: PublicArtistProfileData }) {
  const { profile, artist, isOwnProfile } = data;
  const displayName = profile.display_name || profile.handle || "Artist";
  const primaryLocation = data.studioLocations.find((l) => l.is_primary) ?? data.studioLocations[0];
  const reviewSummary = summarizeReviews(data.reviews.filter((r) => r.is_public));
  const { data: shopBadges } = useArtistShopBadges(artist.id);
  const { colors } = useTheme();

  return (
    <View className="gap-4">
      <View className="flex-row items-end gap-4">
        <Avatar src={profile.avatar_url ?? undefined} name={displayName} size="xl" />
        <View className="flex-1 gap-1">
          <Text className="font-display text-2xl text-content-primary">{displayName}</Text>
          {profile.handle && <Text className="font-mono text-sm text-content-muted">@{profile.handle}</Text>}
        </View>
      </View>

      {artist.tagline && <Text className="text-sm text-content-secondary">{artist.tagline}</Text>}

      <View className="flex-row flex-wrap gap-1.5">
        {primaryLocation && (
          <Badge variant="outline" size="sm">
            {[primaryLocation.city, primaryLocation.state].filter(Boolean).join(", ")}
          </Badge>
        )}
        <Badge variant="outline" size="sm">
          {classificationLabel(artist.classification)}
        </Badge>
        {(shopBadges ?? []).map((badge) => (
          <Pressable
            key={badge.shop_id}
            accessibilityRole="button"
            onPress={() => router.push(`/shop/${badge.handle}` as never)}
          >
            <Badge variant="ember" size="sm">
              {`@ ${badge.name}`}
            </Badge>
          </Pressable>
        ))}
        {reviewSummary.count > 0 && (
          <Badge variant="ember" size="sm" className="gap-1.5">
            {/* Stamped pip — same rating-mark family as <RatingStamps>. */}
            <View
              className="h-2 w-2 rounded-[2px] bg-brand-on-ember"
              style={{ transform: [{ rotate: "-6deg" }] }}
            />
            <Text className="font-sans-semibold text-xs text-brand-on-ember">
              {`${formatRatingAvg(reviewSummary.avg)} · ${reviewSummary.count} review${reviewSummary.count === 1 ? "" : "s"}`}
            </Text>
          </Badge>
        )}
        {travelBadges(artist).map((label) => (
          <Badge key={label} variant="outline" size="sm">
            {label}
          </Badge>
        ))}
        <Badge variant={artist.accepts_new_clients ? "brand" : "neutral"} size="sm">
          {artist.accepts_new_clients ? "Accepting new clients" : "Books closed"}
        </Badge>
      </View>

      {data.styles.length > 0 && (
        <View className="flex-row flex-wrap gap-2">
          {data.styles.map((style) => (
            <View key={style.id} className="rounded-full border border-border-subtle bg-surface-overlay px-3 py-1">
              <Text className="text-xs font-medium text-content-secondary">{style.name}</Text>
            </View>
          ))}
        </View>
      )}

      {!isOwnProfile && (
        <View className="flex-row gap-3 pt-1">
          <Button
            className="flex-1"
            onPress={() => router.push(`/book/${profile.handle}` as never)}
            leadingIcon={<Icon name="calendar" size={16} color={colors.text.primary} />}
          >
            Request a booking
          </Button>
          <Button
            variant="secondary"
            className="flex-1"
            onPress={() => router.push({ pathname: "/messages/new", params: { to: profile.id } } as never)}
            leadingIcon={<Icon name="message-circle" size={16} color={colors.text.secondary} />}
          >
            Message
          </Button>
        </View>
      )}
    </View>
  );
}

function PortfolioGrid({ data }: { data: PublicArtistProfileData }) {
  const pieces = data.portfolioPieces.filter((p) => p.image_url);
  if (pieces.length === 0) return <EmptyTab icon="layout-grid" title="Portfolio coming soon" description="This artist hasn't added portfolio pieces yet." />;
  return (
    <View className="flex-row flex-wrap gap-2.5">
      {pieces.map((piece) => (
        <View key={piece.id} className="aspect-square w-[31%] overflow-hidden rounded-xl bg-surface-overlay">
          <TileImage uri={piece.image_url as string} title={piece.title} icon="image" />
        </View>
      ))}
    </View>
  );
}

function PostsGrid({ data }: { data: PublicArtistProfileData }) {
  const { colors } = useTheme();
  if (data.posts.length === 0) return <EmptyTab icon="image" title="No posts yet" description="Updates from this artist will show up here." />;
  return (
    <View className="flex-row flex-wrap gap-2.5">
      {data.posts.map((post) => {
        const cover =
          post.cover_url ?? (Array.isArray(post.media) && (post.media[0] as { url?: string } | undefined)?.url);
        return (
          <View key={post.id} className="aspect-square w-[31%] overflow-hidden rounded-xl bg-surface-overlay">
            {cover ? (
              <TileImage uri={cover} icon="image" />
            ) : (
              <View className="h-full w-full items-center justify-center">
                <Icon name="image" size={16} color={colors.text.muted} />
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

function FlashList({ data }: { data: PublicArtistProfileData }) {
  const { colors } = useTheme();
  const withItems = data.flashSheets.filter((s) => s.items.length > 0);
  if (withItems.length === 0) return <EmptyTab icon="sparkles" title="No flash available" description="Check back for ready-to-book designs." />;
  return (
    <View className="gap-6">
      {withItems.map((sheet) => (
        <View key={sheet.id} className="gap-3">
          <Text className="font-display text-lg text-content-primary">{sheet.title || "Flash"}</Text>
          <View className="flex-row flex-wrap gap-2.5">
            {sheet.items.map((item) => (
              <View key={item.id} className="w-[31%] overflow-hidden rounded-xl border border-border-subtle bg-surface-raised">
                <View className="aspect-square bg-surface-overlay">
                  {item.image_url ? (
                    <TileImage uri={item.image_url} title={item.title} icon="sparkles" />
                  ) : (
                    <View className="h-full w-full items-center justify-center">
                      <Icon name="sparkles" size={16} color={colors.text.muted} />
                    </View>
                  )}
                </View>
                <View className="gap-0.5 p-2">
                  <Text className="text-xs text-content-muted" numberOfLines={1}>
                    {flashPriceLabel(item.price_cents)}
                  </Text>
                  <Badge variant={item.is_available ? "success" : "neutral"} size="sm" className="self-start">
                    {item.is_available ? "Available" : "Claimed"}
                  </Badge>
                </View>
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

function InfoTab({ data }: { data: PublicArtistProfileData }) {
  const { colors } = useTheme();
  const { artist, services, availabilityRules, bookingPolicy, studioLocations } = data;
  return (
    <View className="gap-6">
      {artist.bio && (
        <View className="gap-2">
          <Eyebrow>About</Eyebrow>
          <Text className="text-content-secondary">{artist.bio}</Text>
        </View>
      )}

      <View className="gap-3">
        <Eyebrow>Services</Eyebrow>
        {services.length === 0 ? (
          <Text className="text-sm text-content-muted">Rates aren&apos;t published yet.</Text>
        ) : (
          <View className="rounded-xl border border-border-subtle bg-surface-raised">
            {services.map((service, i) => (
              <View
                key={service.id}
                className={`flex-row items-center justify-between gap-3 p-4 ${i > 0 ? "border-t border-border-subtle" : ""}`}
              >
                <View className="flex-1 gap-0.5">
                  <Text className="text-sm font-medium text-content-primary">{service.name}</Text>
                  {service.duration_minutes && (
                    <Text className="text-xs text-content-muted">{service.duration_minutes} min</Text>
                  )}
                </View>
                <Text className="font-mono text-sm text-content-accent">{servicePriceLabel(service)}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <Card className="gap-3">
        <View className="flex-row items-center gap-2">
          <Icon name="clock" size={16} color={colors.text.accent} />
          <Text className="text-sm font-semibold text-content-primary">Hours</Text>
        </View>
        <Text className="text-sm text-content-secondary">{hoursSummary(availabilityRules)}</Text>
        <View className="h-px bg-border-subtle" />
        <View className="flex-row items-center gap-2">
          <Icon name="calendar" size={16} color={colors.text.accent} />
          <Text className="text-sm font-semibold text-content-primary">Booking window</Text>
        </View>
        <Badge variant={bookingPolicy?.booking_window === "closed" ? "neutral" : "brand"} size="sm" className="self-start">
          {bookingWindowLabel(bookingPolicy?.booking_window)}
        </Badge>
      </Card>

      {studioLocations.length > 0 && (
        <Card className="gap-3">
          <View className="flex-row items-center gap-2">
            <Icon name="map-pin" size={16} color={colors.text.accent} />
            <Text className="text-sm font-semibold text-content-primary">Studio locations</Text>
          </View>
          {studioLocations.map((location) => (
            <View key={location.id}>
              <Text className="text-sm font-medium text-content-primary">{location.name || "Studio"}</Text>
              <Text className="text-sm text-content-secondary">
                {[location.address_line1, location.city, location.state].filter(Boolean).join(", ")}
              </Text>
            </View>
          ))}
        </Card>
      )}
    </View>
  );
}

/** An image tile that degrades to a titled icon placard when the source fails
 * to load — never an empty box. */
function TileImage({ uri, title, icon = "image" }: { uri: string; title?: string | null; icon?: IconName }) {
  const { colors } = useTheme();
  const [broken, setBroken] = useState(false);
  if (broken) {
    return (
      <View className="h-full w-full items-center justify-center gap-1 bg-surface-raised px-2">
        <Icon name={icon} size={16} color={colors.text.muted} />
        {title ? (
          <Text className="text-center text-[10px] font-medium text-content-secondary" numberOfLines={2}>
            {title}
          </Text>
        ) : null}
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      onError={() => setBroken(true)}
      className="h-full w-full"
      resizeMode="cover"
    />
  );
}

function EmptyTab({ icon, title, description }: { icon: IconName; title: string; description: string }) {
  const { colors } = useTheme();
  return (
    <View className="items-center gap-3 rounded-2xl border border-border-subtle bg-surface-raised/40 px-6 py-16">
      <Icon name={icon} size={26} color={colors.text.muted} />
      <Text className="font-sans-semibold text-base text-content-primary">{title}</Text>
      <Text className="text-center text-sm text-content-muted">{description}</Text>
    </View>
  );
}
