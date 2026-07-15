"use client";

import { useState } from "react";
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
import { TierStamp } from "./TierStamp";
import { actionTypeMeta, formatRelative, formatSlot } from "./meta";
import { StaffNameplate } from "./StaffNameplate";

/**
 * One item in the approvals inbox, as a placard card. The draft reply (or the
 * proposed slots) is front and center; the client message it answers, the tier
 * stamp, the provenance receipt, and the plain-language why sit around it. The
 * artist can approve & send, edit then send (inline), or dismiss — everything a
 * human needs to trust or correct the move before it goes out.
 */
export function ApprovalCard({
  action,
  onApprove,
  onReject,
  busy = false,
  now,
}: {
  action: AgentActionView;
  onApprove: (input: { editedDraftText?: string }) => void;
  onReject: (reason?: string) => void;
  busy?: boolean;
  now?: Date;
}) {
  const meta = actionTypeMeta(action.action_type);
  const draft = action.contract.draft_text ?? "";
  const slots = action.contract.proposed_slots ?? [];
  const isHandoff = action.action_type === "flag.handoff";

  const [editing, setEditing] = useState(false);
  const [draftText, setDraftText] = useState(draft);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  const triggerMsg = useAgentActionTriggerMessage(action);

  return (
    <Card
      padding="none"
      variant="raised"
      className="overflow-hidden"
      data-testid="approval-card"
    >
      <CardPlacard
        meta={
          <span className="flex items-center gap-2">
            <Icon name={meta.icon} size={12} />
            {meta.label}
          </span>
        }
      >
        {formatRelative(action.created_at, now)} · needs your ok
      </CardPlacard>

      <div className="flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <StaffNameplate role={action.agent_role} />
          <TierStamp tier={action.tier} />
        </div>

        {/* The client message it responds to */}
        {triggerMsg.data?.body && (
          <div className="rounded-sm border border-border-subtle bg-surface-overlay/50 p-3">
            <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.16em] text-content-muted">
              Client wrote
            </p>
            <p className="text-sm italic leading-relaxed text-content-secondary">
              &ldquo;{triggerMsg.data.body}&rdquo;
            </p>
          </div>
        )}

        {/* Front and center: the draft, or the proposed slots */}
        {slots.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-content-muted">
              Proposed session times
            </p>
            <ul className="flex flex-col gap-1.5">
              {slots.map((slot, i) => (
                <li
                  key={`${slot.starts_at}-${i}`}
                  className="flex items-center gap-2 rounded-sm bg-surface-plate-ink px-3 py-2 text-sm text-content-primary"
                >
                  <Icon name="calendar" size={15} className="text-content-accent" />
                  {formatSlot(slot.starts_at, slot.ends_at)}
                </li>
              ))}
            </ul>
          </div>
        )}

        {(draft || editing) && (
          <div className="flex flex-col gap-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-content-muted">
              {isHandoff ? "What it prepared" : "Drafted reply"}
            </p>
            {editing ? (
              <TextArea
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                rows={5}
                autoFocus
                aria-label="Edit draft reply"
              />
            ) : (
              <div
                className={cx(
                  "rounded-sm border p-3.5 text-sm leading-relaxed text-content-primary",
                  isHandoff
                    ? "border-warning-600/40 bg-warning-600/5"
                    : "border-border-accent bg-surface-plate-ink",
                )}
              >
                <p className="whitespace-pre-wrap break-words">{draft}</p>
              </div>
            )}
          </div>
        )}

        {/* Why — plain language */}
        {action.reasoning_summary && (
          <div className="flex items-start gap-2">
            <Icon
              name="sparkles"
              size={14}
              className="mt-0.5 shrink-0 text-content-accent"
            />
            <p className="text-[13px] leading-relaxed text-content-secondary">
              {action.reasoning_summary}
            </p>
          </div>
        )}

        {/* Provenance */}
        <ProvenanceBlock context={action.contract.context_used} />

        {isHandoff && (
          <div className="flex items-center gap-2 rounded-sm border border-warning-600/40 bg-warning-600/5 px-3 py-2">
            <Icon name="shield" size={14} className="text-warning-600" />
            <p className="text-[13px] text-content-secondary">
              Your staff won&rsquo;t reply to this on its own — it&rsquo;s here for
              you to handle.
            </p>
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
            {!isHandoff && (
              <Button
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
                {editing ? "Send edited" : slots.length > 0 ? "Approve times" : "Approve & send"}
              </Button>
            )}
            {draft && !isHandoff && (
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
                {editing ? "Cancel edit" : "Edit then send"}
              </Button>
            )}
            {isHandoff ? (
              <Button
                size="sm"
                loading={busy}
                onClick={() => onApprove({})}
              >
                <Icon name="check" size={15} />
                Mark handled
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setRejecting(true)}
                disabled={busy}
              >
                Dismiss
              </Button>
            )}
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
      <TierStamp tier={action.tier} withLabel={false} />
      <Badge variant="neutral" size="sm">
        {action.contract.context_used.length} sources
      </Badge>
    </div>
  );
}
