import { Tabs } from "expo-router";
import { Icon } from "@inkd/ui/native";
import { useCurrentArtistProfile } from "@inkd/core/hooks";
import { useTheme } from "@/providers/theme";

/**
 * Bottom tab bar. Colors follow the active theme (Dark / Light).
 *
 * NAV BY ROLE: a phone's 5-tab bar can't hold the artist Studio group, so
 * artists get a single "Studio" tab that opens the ops hub (Dashboard →
 * Bookings / AI staff / Settings), mirroring the web sidebar's Studio group.
 * Clients — who have no Studio — keep Bookings as a direct tab. Role is
 * detected from the presence of an artist profile; the non-applicable tab is
 * hidden with `href: null` (its route still exists).
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
      {/* Client: Bookings (their own appointments). Hidden for artists. */}
      <Tabs.Screen
        name="bookings"
        options={{
          title: "Bookings",
          href: isArtist ? null : "/bookings",
          tabBarIcon: ({ color, size }) => <Icon name="calendar" color={color} size={size} />,
        }}
      />
      {/* Artist: Studio ops hub (Bookings live inside). Hidden for clients. */}
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
    </Tabs>
  );
}
