import { Pressable, Text, View } from "react-native";
import { Badge, Button, Card, EmptyState, Icon, Skeleton } from "@inkd/ui/native";
import {
  useCurrentArtistProfile,
  useDashboardStats,
  useArtistSessions,
  useAgentSettings,
  useAgentActions,
  SESSION_STATUS_META,
} from "@inkd/core";

import { AiStaffDashboardCard } from "@/components/ai-staff/DashboardCard";
import { StatusBadge, formatTime } from "@/components/bookings/shared";
import { formatMoney } from "@/components/artist/money";
import { AUTONOMY_LABEL } from "@/lib/aiStaff";
import { useStudioNav } from "@/components/studio/StudioNav";
import { useTheme } from "@/providers/theme";

const STAT_LABELS = [
  "Open inquiries",
  "Booked sessions",
  "Deposits held",
  "Rebook rate",
] as const;

/** Deposits-held is money → renders in ember. */
const MONEY_STAT_INDEX = 2;

/**
 * Studio → Dashboard body (stats, today's sessions, AI staff snapshot). The
 * header + segmented bar are owned by StudioScreen; this renders only the
 * dashboard content so the segment can swap it in place.
 */
export function DashboardBody() {
  const goToSegment = useStudioNav();
  const artistQ = useCurrentArtistProfile();
  const artistId = artistQ.data?.id;

  const statsQ = useDashboardStats(artistId);
  const statsLoading = statsQ.isLoading && Boolean(artistId);
  const stats = statsQ.data;

  // Screen hero: a violet "N approvals waiting for you" banner, only when
  // something's pending. Zero pending → no banner, no hero.
  const pendingQ = useAgentActions(artistId, { status: "proposed" });
  const pending = pendingQ.data?.length ?? 0;

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

  return (
    <>
      {pending > 0 ? (
        <View className="relative">
          <View
            pointerEvents="none"
            className="absolute inset-0 rounded-lg bg-hero-shadow"
            style={{ transform: [{ translateX: 5 }, { translateY: 5 }] }}
          />
          <Pressable
            onPress={() => goToSegment("ai")}
            className="w-full flex-row items-center justify-between gap-3 rounded-lg border border-hero-border bg-brand px-5 py-4 active:translate-x-[3px] active:translate-y-[3px]"
            accessibilityRole="button"
          >
            <View className="flex-1">
              <Text className="font-sans-bold text-base text-brand-on">
                {`${pending} approval${pending > 1 ? "s" : ""} waiting for you`}
              </Text>
              <Text className="text-sm text-brand-on/80">
                Drafts ready for your ok before anything reaches a client.
              </Text>
            </View>
            <Icon name="arrow-right" size={20} color="#FAFAFA" />
          </Pressable>
        </View>
      ) : null}

      <View className="flex-row flex-wrap gap-3">
        {STAT_LABELS.map((label, i) => {
          const stat_value = values[i] ?? { value: "0" };
          const isMoney = i === MONEY_STAT_INDEX;
          return (
            <Card key={label} padding="md" className="min-w-[45%] flex-1 gap-1.5">
              <Text className="font-mono text-[10px] uppercase tracking-widest text-content-muted">
                {label}
              </Text>
              {statsLoading ? (
                <Skeleton className="h-7 w-16 rounded-sm" />
              ) : (
                <Text
                  className={
                    isMoney
                      ? "font-mono-medium text-2xl text-content-ember"
                      : "font-display text-2xl font-bold tracking-tight text-content-primary"
                  }
                >
                  {stat_value.value}
                </Text>
              )}
              {stat_value.delta && !statsLoading && (
                <Text className="font-mono text-[10px] uppercase tracking-widest text-content-muted">
                  {stat_value.delta}
                </Text>
              )}
            </Card>
          );
        })}
      </View>

      <TodayPanel artistId={artistId} />

      <AiStaffDashboardCard />
    </>
  );
}

/** "Today" panel: the artist's sessions scheduled for the current calendar
 * day, or the reassuring empty state when there are none. */
function TodayPanel({ artistId }: { artistId: string | undefined }) {
  const { colors } = useTheme();
  const goToSegment = useStudioNav();
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
        <Text className="font-sans text-base font-semibold text-content-primary">Today</Text>
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
          icon={<Icon name="calendar" size={28} color={colors.text.muted} />}
          title="No sessions scheduled today"
          description="When bookings come in, your day board — with holds, deposits and session notes — shows up right here."
          action={
            <Button size="md" onPress={() => goToSegment("bookings")}>
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
