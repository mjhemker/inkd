"use client";

import Link from "next/link";
import {
  Badge,
  Card,
  EmptyState,
  Icon,
  Skeleton,
} from "@inkd/ui/web";
import {
  useCurrentArtistProfile,
  useDashboardStats,
  useArtistSessions,
  useAgentSettings,
  useAgentActions,
  SESSION_STATUS_META,
} from "@inkd/core";
import { LinkButton } from "@/components/link-button";
import { AiStaffDashboardCard } from "@/components/ai-staff/AiStaffDashboardCard";
import { DashboardEyebrow } from "@/components/dashboard-eyebrow";
import { StatusBadge, formatTime } from "@/components/bookings/shared";
import { formatMoney } from "@/components/artist/money";
import { AUTONOMY_LABEL } from "@/components/ai-staff/meta";

const STAT_LABELS = [
  "Open inquiries",
  "Booked sessions",
  "Deposits held",
  "Rebook rate",
] as const;

/** Deposits-held is money → renders in ember (text-money). */
const MONEY_STAT_INDEX = 2;

/**
 * Artist dashboard body. Shared by /dashboard and the /dev/shell preview so the
 * shell chrome can be reviewed with realistic content in place.
 *
 * `liveAiStaff` wires the AI staff card to real agent_actions data (the real
 * /dashboard). The offline /dev/shell preview passes `false` to keep a static,
 * provider-free card so the chrome renders deterministically without a DB.
 */
export function DashboardPreview({
  liveAiStaff = true,
}: {
  liveAiStaff?: boolean;
}) {
  const artistQ = useCurrentArtistProfile();
  const artist = artistQ.data;
  const artistId = artist?.id;

  const statsQ = useDashboardStats(artistId);
  const statsLoading = statsQ.isLoading && Boolean(artistId);

  // The screen hero: a violet "N approvals waiting for you" banner, shown only
  // when the real AI staff data is wired (offline shell preview passes false)
  // and something is actually pending. Zero pending → no banner, no hero.
  const pendingQ = useAgentActions(liveAiStaff ? artistId : undefined, {
    status: "proposed",
  });
  const pending = liveAiStaff ? (pendingQ.data?.length ?? 0) : 0;

  const stats = statsQ.data;
  const values: { value: string; delta?: string }[] = [
    {
      value: String(stats?.openInquiries ?? 0),
    },
    {
      value: String(stats?.bookedSessionsNext30Days ?? 0),
      delta: "next 30 days",
    },
    {
      value: formatMoney(stats?.depositsHeldCents ?? 0),
    },
    stats?.rebook.rate == null
      ? { value: "—", delta: "not enough data yet" }
      : {
          value: `${Math.round(stats.rebook.rate * 100)}%`,
          delta: `${stats.rebook.repeatClients} of ${stats.rebook.totalClients} clients`,
        },
  ];

  return (
    <div className="flex flex-col gap-8">
      {pending > 0 && (
        <Link
          href="/studio/ai"
          className="hero-offset flex w-full items-center justify-between gap-3 rounded-lg bg-brand px-5 py-4 text-brand-on"
        >
          <span className="flex flex-col gap-0.5">
            <span className="font-display text-lg font-bold tracking-tight">
              {pending} approval{pending > 1 ? "s" : ""} waiting for you
            </span>
            <span className="text-sm text-brand-on/80">
              Drafts ready for your ok before anything reaches a client.
            </span>
          </span>
          <Icon name="arrow-right" size={20} className="shrink-0" />
        </Link>
      )}

      <header className="flex flex-col gap-2">
        <DashboardEyebrow fallbackName={liveAiStaff ? undefined : "Jayden Cole"} />
        <h1 className="font-display text-3xl font-bold tracking-tight text-content-primary sm:text-4xl">
          Dashboard
        </h1>
        <p className="max-w-xl text-content-secondary">
          Your chair at a glance — inquiries, sessions and deposits. The live ops
          views land here next.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {STAT_LABELS.map((label, i) => {
          const statValue = values[i] ?? { value: "0" };
          const isMoney = i === MONEY_STAT_INDEX;
          return (
            <Card key={label} padding="md" className="flex flex-col gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-content-muted">
                {label}
              </span>
              {statsLoading ? (
                <Skeleton className="h-8 w-16 rounded-sm" />
              ) : (
                <span
                  className={
                    isMoney
                      ? "text-money text-2xl"
                      : "font-display text-2xl font-bold tracking-tight text-content-primary"
                  }
                >
                  {statValue.value}
                </span>
              )}
              {statValue.delta && !statsLoading && (
                <span className="font-mono text-[11px] uppercase tracking-widest text-content-muted">
                  {statValue.delta}
                </span>
              )}
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <TodayPanel artistId={artistId} />

        {liveAiStaff ? (
          <AiStaffDashboardCard />
        ) : (
          <Card padding="none" className="overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border-subtle px-5 py-4">
              <Icon name="sparkles" size={18} className="text-content-accent" />
              <h2 className="font-sans text-base font-semibold text-content-primary">
                AI staff activity
              </h2>
            </div>
            <EmptyState
              className="py-12"
              icon={<Icon name="shield" size={24} />}
              title="Nothing to review"
              description="Your Front Desk drafts replies for your approval. Everything it does shows up here, with the data it used."
            />
          </Card>
        )}
      </div>
    </div>
  );
}

/**
 * "Today" panel: the artist's sessions scheduled for the current calendar
 * day, or the reassuring empty state when there are none. Replaces the old
 * hardcoded "no sessions" copy with a real `useArtistSessions` read.
 */
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
  const sessions = (sessionsQ.data ?? []).filter(
    (s) => s.status !== "cancelled",
  );

  return (
    <Card padding="none" className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
        <h2 className="font-sans text-base font-semibold text-content-primary">
          Today
        </h2>
        <Badge variant="brand">{AUTONOMY_LABEL[autonomy] ?? autonomy} AI</Badge>
      </div>

      {sessionsQ.isLoading && artistId ? (
        <div className="flex flex-col gap-2 p-5">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-sm" />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <EmptyState
          className="py-12"
          icon={<Icon name="calendar" size={24} />}
          title="No sessions scheduled today"
          description="When bookings come in, your day board — with holds, deposits and session notes — shows up right here."
          action={
            <LinkButton href="/bookings" size="sm">
              Open bookings
            </LinkButton>
          }
        />
      ) : (
        <ul className="divide-y divide-border-subtle">
          {sessions.map((session) => (
            <li
              key={session.id}
              className="flex items-center justify-between gap-3 px-5 py-3"
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-content-primary">
                  {formatTime(session.scheduled_start)}
                </span>
                <span className="text-xs text-content-muted">
                  Session {session.session_number}
                  {session.duration_minutes
                    ? ` · ${session.duration_minutes} min`
                    : ""}
                </span>
              </div>
              <StatusBadge tone={SESSION_STATUS_META[session.status].tone}>
                {SESSION_STATUS_META[session.status].label}
              </StatusBadge>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
