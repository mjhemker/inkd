import {
  Badge,
  Card,
  EmptyState,
  Eyebrow,
  Icon,
  type IconName,
} from "@inkd/ui/web";
import { LinkButton } from "@/components/link-button";

interface Stat {
  label: string;
  value: string;
  delta?: string;
  icon: IconName;
}

const stats: Stat[] = [
  { label: "Open inquiries", value: "7", delta: "+3 this week", icon: "message-circle" },
  { label: "Booked sessions", value: "12", delta: "next 30 days", icon: "calendar" },
  { label: "Deposits held", value: "$1,840", delta: "4 pending", icon: "credit-card" },
  { label: "Rebook rate", value: "68%", delta: "+6 pts", icon: "trending-up" },
];

/**
 * Artist dashboard body. Shared by /dashboard and the /dev/shell preview so the
 * shell chrome can be reviewed with realistic content in place.
 */
export function DashboardPreview() {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <Eyebrow>Studio · Jayden Cole</Eyebrow>
        <h1 className="font-display text-3xl font-bold tracking-tight text-content-primary sm:text-4xl">
          Dashboard
        </h1>
        <p className="max-w-xl text-content-secondary">
          Your chair at a glance — inquiries, sessions and deposits. The live ops
          views land here next.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} padding="md" className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-surface-overlay text-content-accent">
                <Icon name={stat.icon} size={18} />
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-display text-2xl font-bold tracking-tight text-content-primary">
                {stat.value}
              </span>
              <span className="text-sm text-content-secondary">{stat.label}</span>
              {stat.delta && (
                <span className="mt-1 font-mono text-[11px] uppercase tracking-widest text-content-muted">
                  {stat.delta}
                </span>
              )}
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card padding="none" className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
            <h2 className="font-sans text-base font-semibold text-content-primary">
              Today
            </h2>
            <Badge variant="brand">Draft-only AI</Badge>
          </div>
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
        </Card>

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
      </div>
    </div>
  );
}
