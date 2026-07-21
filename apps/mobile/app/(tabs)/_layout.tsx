import { Tabs } from "expo-router";
import { Icon } from "@inkd/ui/native";
import { useAttentionCounts, useCurrentArtistProfile } from "@inkd/core/hooks";
import { useTheme } from "@/providers/theme";

/** expo-router tabBarBadge value with a 9+ cap; undefined hides the badge. */
function badgeValue(count: number): number | string | undefined {
  if (count <= 0) return undefined;
  return count > 9 ? "9+" : count;
}

/**
 * Bottom tab bar. Colors follow the active theme (Dark / Light).
 *
 * NAV BY ROLE (founder spec):
 *   Clients  → Home · Discover · Inbox · Profile           (4 tabs)
 *   Artists  → Home · Discover · Inbox · Profile · Studio  (5 tabs)
 *
 * Inbox (the Messages surface, relabeled with a message icon + red unread
 * badge) now has its OWN middle slot for BOTH roles. Artists get Studio in the
 * fifth slot on the right; clients never see Studio. The messages icon that
 * briefly lived in the Studio dashboard header has been removed — Inbox on the
 * bar is the single entry point for everyone.
 *
 * The artist Studio ops surfaces (dashboard, bookings, AI staff, settings, shop)
 * live in the Studio tab's OWN nested stack (studio/*), so the bottom bar stays
 * visible across all of them. Role is detected from the presence of an artist
 * profile; the Studio tab is hidden for clients with `href: null`.
 *
 * `bookings` is a hidden route (never a visible tab): clients open their own
 * bookings from Profile (push into this stack — bar stays visible); artists use
 * Studio → Bookings. It remains registered so booking-detail back links and any
 * legacy `/(tabs)/bookings` links still resolve.
 */
export default function TabsLayout() {
  const { colors } = useTheme();
  const { data: artist } = useCurrentArtistProfile();
  const isArtist = Boolean(artist);
  const attention = useAttentionCounts();

  // Ember attention badge, matching the web nav pills.
  const badgeStyle = {
    backgroundColor: colors.surface.ember,
    color: colors.brand.onEmber,
    fontSize: 10,
    fontWeight: "700" as const,
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand.primary,
        tabBarInactiveTintColor: colors.text.muted,
        tabBarStyle: {
          backgroundColor: colors.surface.base,
          borderTopColor: colors.border.subtle,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: {
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <Icon name="home" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: "Discover",
          tabBarIcon: ({ color, size }) => <Icon name="compass" color={color} size={size} />,
        }}
      />
      {/* Inbox: the Messages surface, its own middle slot for BOTH roles.
          Message icon + red unread badge. */}
      <Tabs.Screen
        name="messages"
        options={{
          title: "Inbox",
          href: "/messages",
          tabBarBadge: badgeValue(attention.messages),
          tabBarBadgeStyle: badgeStyle,
          tabBarIcon: ({ color, size }) => (
            <Icon name="message-circle" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => <Icon name="user" color={color} size={size} />,
        }}
      />
      {/* Artist: Studio ops hub (dashboard + bookings/AI/settings live inside its
          nested stack). Hidden for clients. Badge sums the studio-scoped items
          (bookings + AI staff), matching the web nav. */}
      <Tabs.Screen
        name="studio"
        options={{
          title: "Studio",
          href: isArtist ? "/studio" : null,
          tabBarBadge: badgeValue(attention.studio),
          tabBarBadgeStyle: badgeStyle,
          tabBarIcon: ({ color, size }) => (
            <Icon name="layout-grid" color={color} size={size} />
          ),
        }}
      />
      {/* Hidden route: client bookings (opened from Profile) + booking-detail
          back target. Never shown as a tab for either role. */}
      <Tabs.Screen
        name="bookings"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
