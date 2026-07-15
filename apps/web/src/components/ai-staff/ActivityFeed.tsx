"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Badge,
  Card,
  CardPlacard,
  EmptyState,
  Icon,
  Skeleton,
  cx,
} from "@inkd/ui/web";
import type { AgentActionView } from "@inkd/core";

import { ProvenanceBlock } from "./ProvenanceBlock";
import { TierStamp } from "./TierStamp";
import { StaffNameplate } from "./StaffNameplate";
import {
  STATUS_META,
  actionDeepLink,
  actionTypeMeta,
  formatRelative,
} from "./meta";

type StatusFilter = "all" | "proposed" | "executed" | "rejected";
type TypeFilter = "all" | "reply" | "booking.propose_slots" | "flag.handoff";

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "proposed", label: "Awaiting" },
  { value: "executed", label: "Sent" },
  { value: "rejected", label: "Dismissed" },
];

const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "Every kind" },
  { value: "reply", label: "Replies" },
  { value: "booking.propose_slots", label: "Times" },
  { value: "flag.handoff", label: "Handoffs" },
];

/**
 * The activity ledger — every move the staff made, newest first, with the why,
 * the data consulted, the outcome, tier stamps and deep-links. This is the
 * "every action visible" requirement (SPEC §5) made literal.
 */
export function ActivityFeed({
  actions,
  isLoading,
  now,
  highlightId,
}: {
  actions: AgentActionView[];
  isLoading?: boolean;
  now?: Date;
  highlightId?: string | null;
}) {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [type, setType] = useState<TypeFilter>("all");

  const filtered = useMemo(() => {
    return actions.filter((a) => {
      if (status !== "all" && a.status !== status) return false;
      if (type === "reply")
        return a.action_type === "reply.draft" || a.action_type === "reply.autosend";
      if (type !== "all") return a.action_type === type;
      return true;
    });
  }, [actions, status, type]);

  return (
    <div className="flex flex-col gap-4" data-testid="activity-feed">
      <div className="flex flex-col gap-2">
        <FilterRow
          options={STATUS_FILTERS}
          value={status}
          onChange={(v) => setStatus(v as StatusFilter)}
        />
        <FilterRow
          options={TYPE_FILTERS}
          value={type}
          onChange={(v) => setType(v as TypeFilter)}
        />
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-sm" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          className="py-12"
          icon={<Icon name="clock" size={22} />}
          title="Nothing logged yet"
          description="Every reply, proposed time and handoff your staff makes will appear here — with the reason and the data behind it."
        />
      ) : (
        <ol className="flex flex-col gap-2.5">
          {filtered.map((action) => (
            <ActivityItem
              key={action.id}
              action={action}
              now={now}
              highlighted={action.id === highlightId}
            />
          ))}
        </ol>
      )}
    </div>
  );
}

function FilterRow({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cx(
            "rounded-sm px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.12em] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand",
            value === opt.value
              ? "bg-surface-plate-ink text-content-accent"
              : "bg-surface-overlay/50 text-content-muted hover:text-content-secondary",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function ActivityItem({
  action,
  now,
  highlighted = false,
}: {
  action: AgentActionView;
  now?: Date;
  highlighted?: boolean;
}) {
  const meta = actionTypeMeta(action.action_type);
  const statusMeta = STATUS_META[action.status];
  const link = actionDeepLink(action);
  const summaryLine =
    action.contract.draft_text ??
    (action.contract.proposed_slots?.length
      ? `${action.contract.proposed_slots.length} session time${action.contract.proposed_slots.length > 1 ? "s" : ""} proposed`
      : action.reasoning_summary ?? meta.blurb);

  return (
    <li id={`action-${action.id}`} className="scroll-mt-24">
      <Card
        padding="none"
        className={cx(
          "overflow-hidden",
          highlighted && "ring-2 ring-brand ring-offset-2 ring-offset-surface-base",
        )}
      >
        <CardPlacard
          meta={
            <Badge variant={statusMeta.variant} size="sm">
              {statusMeta.label}
            </Badge>
          }
        >
          <span className="flex items-center gap-1.5">
            <Icon name={meta.icon} size={12} />
            {meta.label}
          </span>
        </CardPlacard>
        <div className="flex flex-col gap-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <StaffNameplate role={action.agent_role} />
            <span className="font-mono text-[11px] text-content-muted">
              {formatRelative(action.created_at, now)}
            </span>
          </div>

          <p className="line-clamp-3 text-sm leading-relaxed text-content-secondary">
            {summaryLine}
          </p>

          {action.reasoning_summary && summaryLine !== action.reasoning_summary && (
            <p className="flex items-start gap-1.5 text-[13px] text-content-muted">
              <Icon name="sparkles" size={13} className="mt-0.5 shrink-0 text-content-accent" />
              {action.reasoning_summary}
            </p>
          )}

          <details className="group">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-content-muted hover:text-content-secondary">
              <Icon
                name="chevron-right"
                size={12}
                className="transition-transform group-open:rotate-90"
              />
              Data it used ({action.contract.context_used.length})
            </summary>
            <div className="pt-2">
              <ProvenanceBlock context={action.contract.context_used} />
            </div>
          </details>

          <div className="flex items-center justify-between gap-2 pt-0.5">
            <TierStamp tier={action.tier} />
            {link && (
              <Link
                href={link.href}
                className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.1em] text-content-accent hover:underline"
              >
                {link.label}
                <Icon name="arrow-right" size={12} />
              </Link>
            )}
          </div>
        </div>
      </Card>
    </li>
  );
}
