"use client";

import Link from "next/link";
import {
  Badge,
  Card,
  EmptyState,
  Icon,
  Skeleton,
  cx,
} from "@inkd/ui/web";
import {
  useAgentActions,
  useCurrentArtistProfile,
} from "@inkd/core/hooks";

import { STATUS_META, actionTypeMeta, formatRelative } from "./meta";
import { StaffNameplate } from "./StaffNameplate";

/**
 * The dashboard's "AI staff activity" card, wired to real data: the pending
 * approval count and the latest few actions, linking through to /studio/ai.
 * Degrades to the same reassuring empty state when there's nothing yet (or the
 * client can't reach the DB, e.g. the offline shell preview).
 */
export function AiStaffDashboardCard() {
  const { data: artist } = useCurrentArtistProfile();
  const artistId = artist?.id;
  const actionsQ = useAgentActions(artistId, { limit: 12 });

  const actions = actionsQ.data ?? [];
  const pending = actions.filter((a) => a.status === "proposed").length;
  const latest = actions.slice(0, 3);

  return (
    <Card padding="none" className="overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-border-subtle px-5 py-4">
        <Link
          href="/studio/ai"
          className="flex items-center gap-2 outline-none hover:text-content-accent focus-visible:text-content-accent"
        >
          <Icon name="sparkles" size={18} className="text-content-accent" />
          <h2 className="font-sans text-base font-semibold text-content-primary">
            AI staff activity
          </h2>
        </Link>
        {pending > 0 && <Badge variant="warning" size="sm">{pending} to review</Badge>}
      </div>

      {actionsQ.isLoading ? (
        <div className="flex flex-col gap-2 p-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-sm" />
          ))}
        </div>
      ) : latest.length === 0 ? (
        <EmptyState
          className="py-12"
          icon={<Icon name="shield" size={24} />}
          title="Nothing to review"
          description="Your Front Desk drafts replies for your approval. Everything it does shows up here, with the data it used."
        />
      ) : (
        <>
          <ul className="divide-y divide-border-subtle">
            {latest.map((action) => {
              const meta = actionTypeMeta(action.action_type);
              const statusMeta = STATUS_META[action.status];
              const line =
                action.contract.draft_text ??
                (action.contract.proposed_slots?.length
                  ? `${action.contract.proposed_slots.length} times proposed`
                  : action.reasoning_summary ?? meta.blurb);
              return (
                <li key={action.id} className="flex items-start gap-3 px-5 py-3">
                  <span
                    className={cx(
                      "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-sm",
                      action.status === "proposed"
                        ? "bg-surface-ember text-brand-on-ember"
                        : "bg-surface-overlay text-content-muted",
                    )}
                  >
                    <Icon name={meta.icon} size={14} />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <StaffNameplate role={action.agent_role} />
                      <span className="font-mono text-[10px] text-content-muted">
                        {formatRelative(action.created_at)}
                      </span>
                    </div>
                    <p className="line-clamp-1 text-sm text-content-secondary">
                      {line}
                    </p>
                  </div>
                  <Badge variant={statusMeta.variant} size="sm">
                    {statusMeta.label}
                  </Badge>
                </li>
              );
            })}
          </ul>
          <Link
            href="/studio/ai"
            className="flex items-center justify-center gap-1.5 border-t border-border-subtle px-5 py-3 font-mono text-[11px] uppercase tracking-[0.14em] text-content-accent transition-colors hover:bg-surface-raised"
          >
            Open AI staff
            <Icon name="arrow-right" size={13} />
          </Link>
        </>
      )}
    </Card>
  );
}
