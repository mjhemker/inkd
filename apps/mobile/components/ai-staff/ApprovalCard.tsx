import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import {
  Badge,
  Button,
  Card,
  CardPlacard,
  Icon,
  TextArea,
  cx,
} from "@inkd/ui/native";
import {
  useAgentActionTriggerMessage,
  type AgentActionView,
} from "@inkd/core";

import {
  actionTypeMeta,
  formatRelative,
  formatSlot,
  handoffCategory,
  staffName,
  summarizeContextSources,
} from "@/lib/aiStaff";
import { useAiColors, ProvenanceBlock } from "./shared";

const TIER_KIND: Record<string, string> = {
  "reply.draft": "DRAFTS",
  "reply.autosend": "AUTO",
  "booking.propose_slots": "TIMES",
  "flag.handoff": "HANDOFF",
  "note.log": "NOTE",
};

/**
 * One approvals-inbox item — condensed. The draft (or proposed times) leads with
 * a violet left rule; the reasoning collapses to one line and the full
 * provenance hides behind compact source-count chips. Tier-3 handoffs get their
 * own red-headed layout and are never auto-sent. Only the ONE top card's
 * "Approve & send" is the screen hero.
 */
export function ApprovalCard({
  action,
  onApprove,
  onReject,
  busy = false,
  hero = false,
}: {
  action: AgentActionView;
  onApprove: (input: { editedDraftText?: string }) => void;
  onReject: (reason?: string) => void;
  busy?: boolean;
  /** True only on the single top card — its Approve & send is the screen hero. */
  hero?: boolean;
}) {
  const AI_COLORS = useAiColors();
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

  // ── Tier-3 handoff: red-headed, never auto-sent, no hero ──────────────────
  if (isHandoff) {
    return (
      <Card padding="none" variant="raised" className="overflow-hidden">
        <View className="flex-row items-center justify-between gap-2 border-b border-danger-600/50 bg-surface-overlay px-4 py-2">
          <Text className="flex-1 font-mono text-[11px] uppercase tracking-widest text-danger-600">
            {`${staffName(action.agent_role)} · Flagged for you · ${formatRelative(action.created_at)}`}
          </Text>
          <Badge variant="outline" size="sm">TIER 3 · NEVER AUTO-SENT</Badge>
        </View>

        <View className="gap-3.5 p-4">
          {triggerMsg.data?.body ? (
            <View className="rounded-sm border border-border-subtle bg-surface-plate-ink/60 p-3">
              <Text className="mb-1 font-mono text-[10px] uppercase tracking-widest text-content-muted">
                Client wrote
              </Text>
              <Text className="text-sm italic leading-relaxed text-content-secondary">
                {`“${triggerMsg.data.body}”`}
              </Text>
            </View>
          ) : null}

          {action.reasoning_summary ? (
            <Text className="text-[13px] leading-relaxed text-content-secondary">
              {action.reasoning_summary}
            </Text>
          ) : null}

          <View className="flex-row">
            <Badge variant="stamp" size="md">{handoffCategory(action)}</Badge>
          </View>

          <View className="flex-row flex-wrap items-center gap-3">
            <Pressable
              disabled={busy}
              onPress={() => onApprove({})}
              className={cx(
                "h-9 flex-row items-center justify-center rounded-lg bg-content-primary px-4",
                busy && "opacity-50",
              )}
              accessibilityRole="button"
            >
              <Text className="font-sans-semibold text-sm text-surface-base">Mark handled</Text>
            </Pressable>
            {action.thread_id ? (
              <Pressable
                onPress={() => router.push(`/(tabs)/messages/${action.thread_id}` as never)}
                className="flex-row items-center gap-1"
                accessibilityRole="link"
              >
                <Text className="font-mono text-[11px] uppercase tracking-wider text-content-accent">
                  Open thread
                </Text>
                <Icon name="arrow-right" size={13} color={AI_COLORS.accent} />
              </Pressable>
            ) : null}
          </View>
        </View>
      </Card>
    );
  }

  // ── Standard approval (draft / proposed times) — condensed ────────────────
  return (
    <Card padding="none" variant="raised" className="overflow-hidden">
      <CardPlacard
        meta={`TIER ${action.tier} · ${TIER_KIND[action.action_type] ?? "DRAFT"}`}
      >
        {`${staffName(action.agent_role)} · ${meta.label} · ${formatRelative(action.created_at)}`}
      </CardPlacard>

      <View className="gap-3 p-4">
        {slots.length > 0 ? (
          <View className="flex-row flex-wrap gap-1.5">
            {slots.map((slot, i) => (
              <Badge key={`${slot.starts_at}-${i}`} variant="date" size="md">
                {formatSlot(slot.starts_at, slot.ends_at)}
              </Badge>
            ))}
          </View>
        ) : null}

        {editing ? (
          <TextArea value={draftText} onChangeText={setDraftText} numberOfLines={5} />
        ) : draft ? (
          <View className="border-l-2 border-border-accent pl-3">
            <Text className="text-sm leading-relaxed text-content-primary">{draft}</Text>
          </View>
        ) : null}

        {action.reasoning_summary ? (
          <Pressable
            onPress={() => setWhyOpen((v) => !v)}
            className="flex-row items-start gap-2"
            accessibilityRole="button"
          >
            <Icon name="sparkles" size={13} color={AI_COLORS.accent} />
            <Text
              className="flex-1 text-[13px] leading-relaxed text-content-secondary"
              numberOfLines={whyOpen ? undefined : 1}
            >
              {action.reasoning_summary}
            </Text>
          </Pressable>
        ) : null}

        {totalSources > 0 ? (
          <View className="gap-2">
            <View className="flex-row flex-wrap items-center gap-1.5">
              {sources.map((s) => (
                <View
                  key={s.source}
                  className="rounded-sm bg-surface-plate-ink px-2 py-0.5"
                >
                  <Text className="font-mono text-[10px] uppercase tracking-wider text-content-muted">
                    {`${s.short} ${s.count}`}
                  </Text>
                </View>
              ))}
              <Pressable
                onPress={() => setSourcesOpen((v) => !v)}
                className="flex-row items-center gap-1 rounded-sm border border-border-subtle px-2 py-0.5"
                accessibilityRole="button"
              >
                <Text className="font-mono text-[10px] uppercase tracking-wider text-content-accent">
                  {`All ${totalSources}`}
                </Text>
                <Icon
                  name={sourcesOpen ? "chevron-down" : "chevron-right"}
                  size={11}
                  color={AI_COLORS.accent}
                />
              </Pressable>
            </View>
            {sourcesOpen ? <ProvenanceBlock context={action.contract.context_used} /> : null}
          </View>
        ) : null}

        {rejecting ? (
          <View className="gap-2 rounded-sm border border-border-subtle bg-surface-overlay/40 p-3">
            <Text className="font-mono text-[10px] uppercase tracking-widest text-content-muted">
              Reason (optional)
            </Text>
            <TextArea value={reason} onChangeText={setReason} numberOfLines={2} placeholder="e.g. price was off, wrong tone…" />
            <View className="flex-row justify-end gap-2">
              <Button variant="ghost" size="sm" onPress={() => setRejecting(false)} disabled={busy}>
                Cancel
              </Button>
              <Button variant="danger" size="sm" loading={busy} onPress={() => onReject(reason.trim() || undefined)}>
                Dismiss
              </Button>
            </View>
          </View>
        ) : (
          <View className="flex-row flex-wrap items-center gap-2">
            <Button
              hero={hero}
              size="sm"
              loading={busy && !editing}
              onPress={() =>
                onApprove(editing && draftText !== draft ? { editedDraftText: draftText } : {})
              }
            >
              {editing ? "Send edited" : slots.length > 0 ? "Approve times" : "Approve & send"}
            </Button>
            {draft ? (
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onPress={() => {
                  setEditing((v) => !v);
                  setDraftText(draft);
                }}
              >
                {editing ? "Cancel edit" : "Edit"}
              </Button>
            ) : null}
            <Button variant="ghost" size="sm" disabled={busy} onPress={() => setRejecting(true)}>
              Dismiss
            </Button>
          </View>
        )}
      </View>
    </Card>
  );
}
