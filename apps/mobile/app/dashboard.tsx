import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Icon,
  Skeleton,
  type IconName,
} from "@inkd/ui/native";
import {
  useCurrentProfile,
  useCurrentArtistProfile,
  useDashboardStats,
  useArtistSessions,
  useAgentSettings,
  SESSION_STATUS_META,
} from "@inkd/core";

import { ScreenHeader } from "@/components/ScreenHeader";
import { AiStaffDashboardCard } from "@/components/ai-staff/DashboardCard";
import { ArtistOnly } from "@/components/ArtistOnly";
import { StatusBadge, formatTime } from "@/components/bookings/shared";
import { formatMoney } from "@/components/artist/money";
import { AUTONOMY_LABEL } from "@/lib/aiStaff";

interface StatDef {
  label: string;
  icon: IconName;
}

const STAT_DEFS: StatDef[] = [
  { label: "Open inquiries", icon: "message-circle" },
  { label: "Booked sessions", icon: "calendar" },
  { label: "Deposits held", icon: "credit-card" },
  { label: "Rebook rate", icon: "trending-up" },
];

export default function DashboardScreen() {
  const profileQ = useCurrentProfile();
  const artistQ = useCurrentArtistProfile();
  const artistId = artistQ.data?.id;

  const statsQ = useDashboardStats(artistId);
  const statsLoading = statsQ.isLoading && Boolean(artistId);
  const stats = statsQ.data;

  const values: { value: string; delta?: string }[] = [
    { value: String(stats?.openInquiries ?? 0) },
    {
      value: String(stats?.bookedSessionsNext30Days ?? 0),
      delta: "next 30 days",
    },
    { value: formatMoney(stats?.depositsHeldCents ?? 0) },
    stats?.rebook.rate == null
      ? { value: "—", delta: "not enough data yet" }
      : {
          value: `${Math.round(stats.rebook.rate * 100)}%`,
          delta: `${stats.rebook.repeatClients} of ${stats.rebook.totalClients} clients`,
        },
  ];

  const displayName =
    profileQ.data?.display_name ?? profileQ.data?.handle ?? "your studio";

  return (
    <ArtistOnly requireOnboarding>
      <DashboardContent />
    </ArtistOnly>
  );
}

function DashboardContent() {
  return (
    <SafeAreaView className="flex-1 bg-surface-base" edges={["top", "bottom"]}>
      <ScrollView className="flex-1" contentContainerClassName="gap-6 px-6 py-8">
        <ScreenHeader
          eyebrow={`STUDIO OPS · ${displayName.toUpperCase()}`}
          title="Dashboard"
          subtitle="Your operational overview — bookings, revenue, and requests at a glance."
        />

        <View className="flex-row flex-wrap gap-3">
          {STAT_DEFS.map((stat, i) => {
            const stat_value = values[i] ?? { value: "0" };
            return (
              <Card
                key={stat.label}
                padding="md"
                className="min-w-[45%] flex-1 gap-3"
              >
                <View className="h-9 w-9 items-center justify-center rounded-lg bg-surface-overlay">
                  <Icon name={stat.icon} size={18} color="#A78BFA" />
                </View>
                {statsLoading ? (
                  <Skeleton className="h-7 w-16 rounded-sm" />
                ) : (
                  <Text className="font-display text-2xl font-bold tracking-tight text-content-primary">
                    {stat_value.value}
                  </Text>
                )}
                <Text className="text-sm text-content-secondary">{stat.label}</Text>
                {stat_value.delta && !statsLoading && (
                  <Text className="-mt-2 font-mono text-[10px] uppercase tracking-widest text-content-muted">
                    {stat_value.delta}
                  </Text>
                )}
              </Card>
            );
          })}
        </View>

        <TodayPanel artistId={artistId} />

        <AiStaffDashboardCard />
      </ScrollView>
    </SafeAreaView>
  );
}

/** "Today" panel: the artist's sessions scheduled for the current calendar
 * day, or the reassuring empty state when there are none. */
function TodayPanel({ artistId }: { artistId: string | undefined }) {
  const settingsQ = useAgentSettings(artistId ?? "");
  const autonomy = settingsQ.data?.autonomy ?? "draft_only";

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date();
  dayEnd.setHours(23, 59, 59, 999);
  const sessionsQ = useArtistSessions(artistId ?? "", {
    from: dayStart.toISOString(),
    to: dayEnd.toISOString(),
  });
  const sessions = (sessionsQ.data ?? []).filter((s) => s.status !== "cancelled");

  return (
    <Card padding="none" className="overflow-hidden">
      <View className="flex-row items-center justify-between border-b border-border-subtle px-4 py-3">
        <Text className="font-sans text-base font-semibold text-content-primary">
          Today
        </Text>
        <Badge variant="brand">{`${AUTONOMY_LABEL[autonomy] ?? autonomy} AI`}</Badge>
      </View>

      {sessionsQ.isLoading && artistId ? (
        <View className="gap-2 p-4">
          <Skeleton className="h-12 w-full rounded-sm" />
          <Skeleton className="h-12 w-full rounded-sm" />
        </View>
      ) : sessions.length === 0 ? (
        <EmptyState
          className="py-10"
          icon={<Icon name="calendar" size={28} color="#71717A" />}
          title="No sessions scheduled today"
          description="When bookings come in, your day board — with holds, deposits and session notes — shows up right here."
          action={
            <Button size="md" onPress={() => router.push("/bookings")}>
              Open bookings
            </Button>
          }
        />
      ) : (
        <View>
          {sessions.map((session) => (
            <View
              key={session.id}
              className="flex-row items-center justify-between gap-3 border-b border-border-subtle px-4 py-3 last:border-0"
            >
              <View className="gap-0.5">
                <Text className="text-sm font-medium text-content-primary">
                  {formatTime(session.scheduled_start)}
                </Text>
                <Text className="text-xs text-content-muted">
                  {`Session ${session.session_number}${
                    session.duration_minutes ? ` · ${session.duration_minutes} min` : ""
                  }`}
                </Text>
              </View>
              <StatusBadge tone={SESSION_STATUS_META[session.status].tone}>
                {SESSION_STATUS_META[session.status].label}
              </StatusBadge>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}
