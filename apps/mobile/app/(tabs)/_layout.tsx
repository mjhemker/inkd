import { Tabs } from "expo-router";
import { Icon } from "@inkd/ui/native";
import { useCurrentArtistProfile } from "@inkd/core/hooks";
import { useTheme } from "@/providers/theme";

/**
 * Bottom tab bar. Colors follow the active theme (Dark / Light).
 *
 * NAV BY ROLE (founder spec):
 *   Clients  → Home · Discover · Messages · Profile            (4 tabs)
 *   Artists  → Home · Discover · Messages · Profile · Studio   (5 tabs)
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
      <Tabs.Screen
        name="messages"
        options={{
          title: "Messages",
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
          nested stack). Hidden for clients. */}
      <Tabs.Screen
        name="studio"
        options={{
          title: "Studio",
          href: isArtist ? "/studio" : null,
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
