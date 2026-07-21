"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Badge,
  Button,
  Card,
  CardPlacard,
  Icon,
  TextArea,
  cx,
} from "@inkd/ui/web";
import {
  useAgentActionTriggerMessage,
  type AgentActionView,
} from "@inkd/core";

import { ProvenanceBlock } from "./ProvenanceBlock";
import {
  STAFF,
  actionDeepLink,
  actionTypeMeta,
  formatRelative,
  formatSlot,
  handoffCategory,
  summarizeContextSources,
} from "./meta";

/** Short mono kind label for the tier chip ("TIER 1 · DRAFTS"). */
const TIER_KIND: Record<string, string> = {
  "reply.draft": "DRAFTS",
  "reply.autosend": "AUTO",
  "booking.propose_slots": "TIMES",
  "flag.handoff": "HANDOFF",
  "note.log": "NOTE",
};

function staffName(role: AgentActionView["agent_role"]): string {
  return STAFF.find((s) => s.role === role)?.name ?? "AI staff";
}

/**
 * One item in the approvals inbox — condensed. The draft (or proposed slots) is
 * front and center with a violet left rule; the reasoning collapses to one line
 * and the full provenance hides behind compact source-count chips (RATES 3 ·
 * POLICY 1 · ALL N). Tier-3 handoffs get their own red-headed layout and are
 * never auto-sent. Only the ONE top card's "Approve & send" is the screen hero.
 */
export function ApprovalCard({
  action,
  onApprove,
  onReject,
  busy = false,
  hero = false,
  now,
}: {
  action: AgentActionView;
  onApprove: (input: { editedDraftText?: string }) => void;
  onReject: (reason?: string) => void;
  busy?: boolean;
  /** True only on the single top card — its Approve & send is the screen hero. */
  hero?: boolean;
  now?: Date;
}) {
  const meta = actionTypeMeta(action.action_type);
  const draft = action.contract.draft_text ?? "";
  const slots = action.contract.proposed_slots ?? [];
  const isHandoff = action.action_type === "flag.handoff";
  const sources = summarizeContextSources(action.contract.context_used);
  const totalSources = action.contract.context_used.length;

  const [editing, setEditing] = useState(false);
  const [draftText, setDraftText] = useState(draft);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [whyOpen, setWhyOpen] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);

  const triggerMsg = useAgentActionTriggerMessage(action);
  const link = actionDeepLink(action);

  // ── Tier-3 handoff: its own red-headed placard, never auto-sent, no hero ──
  if (isHandoff) {
    return (
      <Card
        padding="none"
        variant="raised"
        className="overflow-hidden"
        data-testid="approval-card"
      >
        <div className="flex items-center justify-between gap-3 border-b border-danger-600/50 bg-surface-overlay px-4 py-2">
          <span className="truncate font-mono text-[11px] uppercase tracking-[0.16em] text-danger-600">
            {staffName(action.agent_role)} · Flagged for you ·{" "}
            {formatRelative(action.created_at, now)}
          </span>
          <Badge variant="outline" size="sm" className="font-mono uppercase tracking-[0.12em]">
            Tier 3 · Never auto-sent
          </Badge>
        </div>

        <div className="flex flex-col gap-3.5 p-4">
          {triggerMsg.data?.body && (
            <div className="rounded-sm border border-border-subtle bg-surface-plate-ink/60 p-3">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.16em] text-content-muted">
                Client wrote
              </p>
              <p className="text-sm italic leading-relaxed text-content-secondary">
                &ldquo;{triggerMsg.data.body}&rdquo;
              </p>
            </div>
          )}

          {action.reasoning_summary && (
            <p className="text-[13px] leading-relaxed text-content-secondary">
              {action.reasoning_summary}
            </p>
          )}

          <div>
            <Badge variant="stamp" size="md">
              {handoffCategory(action)}
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-0.5">
            <button
              type="button"
              disabled={busy}
              onClick={() => onApprove({})}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-content-primary px-4 text-sm font-semibold text-surface-base outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base disabled:opacity-50"
            >
              <Icon name="check" size={15} />
              Mark handled
            </button>
            {link && (
              <Link
                href={link.href}
                className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.12em] text-content-accent hover:underline"
              >
                Open thread
                <Icon name="arrow-right" size={13} />
              </Link>
            )}
          </div>
        </div>
      </Card>
    );
  }

  // ── Standard approval (draft / proposed times) — condensed ────────────────
  return (
    <Card
      padding="none"
      variant="raised"
      className="overflow-hidden"
      data-testid="approval-card"
    >
      <CardPlacard
        meta={
          <span className="font-mono uppercase tracking-[0.12em] text-content-accent">
            Tier {action.tier} · {TIER_KIND[action.action_type] ?? "DRAFT"}
          </span>
        }
      >
        {staffName(action.agent_role)} · {meta.label} ·{" "}
        {formatRelative(action.created_at, now)}
      </CardPlacard>

      <div className="flex flex-col gap-3 p-4">
        {/* Proposed times → soft-gray date chips */}
        {slots.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {slots.map((slot, i) => (
              <Badge key={`${slot.starts_at}-${i}`} variant="date" size="md">
                {formatSlot(slot.starts_at, slot.ends_at)}
              </Badge>
            ))}
          </div>
        )}

        {/* The draft, with a violet left rule (or the inline editor) */}
        {editing ? (
          <TextArea
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            rows={5}
            autoFocus
            aria-label="Edit draft reply"
          />
        ) : (
          draft && (
            <p className="border-l-2 border-border-accent pl-3 text-sm leading-relaxed text-content-primary">
              {draft}
            </p>
          )
        )}

        {/* Why — one line, expandable */}
        {action.reasoning_summary && (
          <button
            type="button"
            onClick={() => setWhyOpen((v) => !v)}
            className="flex items-start gap-2 text-left outline-none"
          >
            <Icon
              name="sparkles"
              size={13}
              className="mt-0.5 shrink-0 text-content-accent"
            />
            <span
              className={cx(
                "text-[13px] leading-relaxed text-content-secondary",
                !whyOpen && "line-clamp-1",
              )}
            >
              {action.reasoning_summary}
            </span>
          </button>
        )}

        {/* Compact source-count chips; ALL expands the full provenance */}
        {totalSources > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {sources.map((s) => (
                <span
                  key={s.source}
                  className="inline-flex items-center gap-1 rounded-sm bg-surface-plate-ink px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-content-muted"
                >
                  {s.short} {s.count}
                </span>
              ))}
              <button
                type="button"
                onClick={() => setSourcesOpen((v) => !v)}
                className="inline-flex items-center gap-1 rounded-sm border border-border-subtle px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-content-accent outline-none hover:border-border-accent"
              >
                All {totalSources}
                <Icon
                  name="chevron-down"
                  size={11}
                  className={cx("transition-transform", sourcesOpen && "rotate-180")}
                />
              </button>
            </div>
            {sourcesOpen && (
              <ProvenanceBlock context={action.contract.context_used} />
            )}
          </div>
        )}

        {/* Actions */}
        {rejecting ? (
          <div className="flex flex-col gap-2 rounded-sm border border-border-subtle bg-surface-overlay/40 p-3">
            <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-content-muted">
              Reason (optional — helps your staff learn)
            </label>
            <TextArea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="e.g. price was off, wrong tone…"
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setRejecting(false)}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                loading={busy}
                onClick={() => onReject(reason.trim() || undefined)}
              >
                Dismiss
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              hero={hero}
              size="sm"
              loading={busy && !editing}
              onClick={() =>
                onApprove(
                  editing && draftText !== draft
                    ? { editedDraftText: draftText }
                    : {},
                )
              }
            >
              <Icon name="check" size={15} />
              {editing
                ? "Send edited"
                : slots.length > 0
                  ? "Approve times"
                  : "Approve & send"}
            </Button>
            {draft && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditing((v) => !v);
                  setDraftText(draft);
                }}
                disabled={busy}
              >
                <Icon name="settings" size={15} />
                {editing ? "Cancel edit" : "Edit"}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRejecting(true)}
              disabled={busy}
            >
              Dismiss
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

/** Compact provenance/tier line used by other summaries. */
export function ActionMetaRow({ action }: { action: AgentActionView }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="outline" size="sm" className="font-mono uppercase tracking-[0.12em]">
        Tier {action.tier}
      </Badge>
      <Badge variant="neutral" size="sm">
        {action.contract.context_used.length} sources
      </Badge>
    </div>
  );
}
