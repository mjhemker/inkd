import { useState } from "react";
import { Text, View } from "react-native";
import {
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

import { actionTypeMeta, formatRelative, formatSlot } from "@/lib/aiStaff";
import { AI_COLORS, ProvenanceBlock, TierStamp } from "./shared";
import { StaffNameplate } from "./StaffNameplate";

/**
 * One approvals-inbox item: the draft (or proposed times) front and center, the
 * client message it answers, the tier stamp, the provenance receipt, the plain
 * why, and approve / edit-then-send / dismiss actions.
 */
export function ApprovalCard({
  action,
  onApprove,
  onReject,
  busy = false,
}: {
  action: AgentActionView;
  onApprove: (input: { editedDraftText?: string }) => void;
  onReject: (reason?: string) => void;
  busy?: boolean;
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
    <Card padding="none" variant="raised" className="overflow-hidden">
      <CardPlacard meta={<Text className="font-mono text-[11px] uppercase tracking-widest text-content-secondary">{meta.label}</Text>}>
        {`${formatRelative(action.created_at)} · needs your ok`}
      </CardPlacard>

      <View className="gap-4 p-4">
        <View className="flex-row flex-wrap items-center justify-between gap-2">
          <StaffNameplate role={action.agent_role} />
          <TierStamp tier={action.tier} withLabel={false} />
        </View>

        {triggerMsg.data?.body ? (
          <View className="rounded-sm border border-border-subtle bg-surface-overlay/50 p-3">
            <Text className="mb-1 font-mono text-[10px] uppercase tracking-widest text-content-muted">
              Client wrote
            </Text>
            <Text className="text-sm italic leading-relaxed text-content-secondary">
              {`“${triggerMsg.data.body}”`}
            </Text>
          </View>
        ) : null}

        {slots.length > 0 ? (
          <View className="gap-2">
            <Text className="font-mono text-[10px] uppercase tracking-widest text-content-muted">
              Proposed session times
            </Text>
            {slots.map((slot, i) => (
              <View
                key={`${slot.starts_at}-${i}`}
                className="flex-row items-center gap-2 rounded-sm bg-surface-plate-ink px-3 py-2"
              >
                <Icon name="calendar" size={15} color={AI_COLORS.accent} />
                <Text className="text-sm text-content-primary">
                  {formatSlot(slot.starts_at, slot.ends_at)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {draft || editing ? (
          <View className="gap-2">
            <Text className="font-mono text-[10px] uppercase tracking-widest text-content-muted">
              {isHandoff ? "What it prepared" : "Drafted reply"}
            </Text>
            {editing ? (
              <TextArea value={draftText} onChangeText={setDraftText} numberOfLines={5} />
            ) : (
              <View
                className={cx(
                  "rounded-sm border p-3",
                  isHandoff ? "border-warning-600/40 bg-warning-600/10" : "border-border-accent bg-surface-plate-ink",
                )}
              >
                <Text className="text-sm leading-relaxed text-content-primary">{draft}</Text>
              </View>
            )}
          </View>
        ) : null}

        {action.reasoning_summary ? (
          <View className="flex-row items-start gap-2">
            <Icon name="sparkles" size={14} color={AI_COLORS.accent} />
            <Text className="flex-1 text-[13px] leading-relaxed text-content-secondary">
              {action.reasoning_summary}
            </Text>
          </View>
        ) : null}

        <ProvenanceBlock context={action.contract.context_used} />

        {isHandoff ? (
          <View className="flex-row items-center gap-2 rounded-sm border border-warning-600/40 bg-warning-600/10 px-3 py-2">
            <Icon name="shield" size={14} color={AI_COLORS.warn} />
            <Text className="flex-1 text-[13px] text-content-secondary">
              Your staff won’t reply to this on its own — it’s here for you to handle.
            </Text>
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
            {isHandoff ? (
              <Button size="sm" loading={busy} onPress={() => onApprove({})}>
                Mark handled
              </Button>
            ) : (
              <>
                <Button
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
              </>
            )}
          </View>
        )}
      </View>
    </Card>
  );
}
