"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Badge,
  EmptyState,
  Icon,
  Skeleton,
  cx,
} from "@inkd/ui/web";
import type { AgentActionStatus, AgentActionView } from "@inkd/core";

import { ProvenanceBlock } from "./ProvenanceBlock";
import {
  STAFF,
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

/** Gray sent/dismissed label + red AWAITING stamp (red = counts & medical). */
const STATUS_STAMP: Record<AgentActionStatus, string> = {
  proposed: "Awaiting you",
  approved: "Approved",
  executed: "Sent",
  rejected: "Dismissed",
  failed: "Failed",
  superseded: "Superseded",
};

function staffName(role: AgentActionView["agent_role"]): string {
  return STAFF.find((s) => s.role === role)?.name ?? "AI staff";
}

/**
 * The activity ledger — every move the staff made, newest first. Zine pass: each
 * row condenses to a status stamp + mono "AGENT · KIND" + one-line summary + a
 * tier chip; tapping a row expands the full why + provenance receipt + deep
 * link. No more full-height cards in the list.
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
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-sm" />
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
        <ol className="flex flex-col gap-2">
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

function StatusStamp({ status }: { status: AgentActionStatus }) {
  if (status === "proposed") {
    return (
      <Badge variant="stamp" size="sm">
        {STATUS_STAMP.proposed}
      </Badge>
    );
  }
  return (
    <span className="inline-flex h-5 shrink-0 items-center rounded-sm bg-surface-overlay px-2 font-mono text-[10px] uppercase tracking-[0.12em] text-content-muted">
      {STATUS_STAMP[status]}
    </span>
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
  const [open, setOpen] = useState(false);
  const meta = actionTypeMeta(action.action_type);
  const link = actionDeepLink(action);
  const summaryLine =
    action.contract.draft_text ??
    (action.contract.proposed_slots?.length
      ? `${action.contract.proposed_slots.length} session time${action.contract.proposed_slots.length > 1 ? "s" : ""} proposed`
      : action.reasoning_summary ?? meta.blurb);

  return (
    <li id={`action-${action.id}`} className="scroll-mt-24">
      <div
        className={cx(
          "overflow-hidden rounded-sm border bg-surface-raised",
          highlighted ? "border-brand" : "border-border-subtle",
        )}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-3 px-4 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <StatusStamp status={action.status} />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-content-primary">
              {staffName(action.agent_role)} · {meta.label}
            </span>
            <span className="line-clamp-1 text-sm text-content-secondary">
              {summaryLine}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.12em] text-content-muted sm:inline">
              Tier {action.tier}
            </span>
            <Icon
              name="chevron-down"
              size={14}
              className={cx(
                "text-content-muted transition-transform",
                open && "rotate-180",
              )}
            />
          </span>
        </button>

        {open && (
          <div className="flex flex-col gap-3 border-t border-border-subtle px-4 py-3">
            <span className="flex items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-content-muted">
              <span>Tier {action.tier}</span>
              <span>{formatRelative(action.created_at, now)}</span>
            </span>
            {action.reasoning_summary &&
              action.reasoning_summary !== summaryLine && (
                <p className="flex items-start gap-1.5 text-[13px] leading-relaxed text-content-secondary">
                  <Icon
                    name="sparkles"
                    size={13}
                    className="mt-0.5 shrink-0 text-content-accent"
                  />
                  {action.reasoning_summary}
                </p>
              )}
            <ProvenanceBlock context={action.contract.context_used} />
            {link && (
              <Link
                href={link.href}
                className="inline-flex items-center gap-1 self-start font-mono text-[11px] uppercase tracking-[0.1em] text-content-accent hover:underline"
              >
                {link.label}
                <Icon name="arrow-right" size={12} />
              </Link>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
