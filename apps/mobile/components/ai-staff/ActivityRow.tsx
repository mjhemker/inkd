import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Badge, Icon } from "@inkd/ui/native";
import type { AgentActionStatus, AgentActionView } from "@inkd/core";

import { actionTypeMeta, formatRelative, staffName } from "@/lib/aiStaff";
import { useAiColors, ProvenanceBlock } from "./shared";

const STATUS_STAMP: Record<AgentActionStatus, string> = {
  proposed: "Awaiting you",
  approved: "Approved",
  executed: "Sent",
  rejected: "Dismissed",
  failed: "Failed",
  superseded: "Superseded",
};

function deepLink(action: AgentActionView): { href: string; label: string } | null {
  if (action.thread_id)
    return { href: `/(tabs)/messages/${action.thread_id}`, label: "Open thread" };
  if (action.booking_id)
    return { href: `/bookings/${action.booking_id}`, label: "Open booking" };
  if (action.booking_request_id)
    return { href: `/bookings/requests/${action.booking_request_id}`, label: "Open request" };
  return null;
}

/** Red AWAITING stamp / gray everything else (red = counts & medical only). */
function StatusStamp({ status }: { status: AgentActionStatus }) {
  if (status === "proposed") {
    return <Badge variant="stamp" size="sm">{STATUS_STAMP.proposed}</Badge>;
  }
  return (
    <View className="rounded-sm bg-surface-overlay px-2 py-0.5">
      <Text className="font-mono text-[10px] uppercase tracking-wider text-content-muted">
        {STATUS_STAMP[status]}
      </Text>
    </View>
  );
}

/**
 * One condensed row of the activity ledger — a status stamp + mono "AGENT ·
 * KIND" + one-line summary + tier chip. Tapping the row expands the full why +
 * provenance receipt + deep link.
 */
export function ActivityRow({
  action,
  highlighted = false,
}: {
  action: AgentActionView;
  highlighted?: boolean;
}) {
  const AI_COLORS = useAiColors();
  const meta = actionTypeMeta(action.action_type);
  const link = deepLink(action);
  const [open, setOpen] = useState(false);
  const summary =
    action.contract.draft_text ??
    (action.contract.proposed_slots?.length
      ? `${action.contract.proposed_slots.length} session time(s) proposed`
      : action.reasoning_summary ?? meta.blurb);

  return (
    <View
      className={`overflow-hidden rounded-sm border bg-surface-raised ${highlighted ? "border-brand" : "border-border-subtle"}`}
    >
      <Pressable
        onPress={() => setOpen((v) => !v)}
        className="flex-row items-center gap-3 px-4 py-3"
        accessibilityRole="button"
      >
        <StatusStamp status={action.status} />
        <View className="flex-1">
          <Text className="font-mono text-[11px] uppercase tracking-wider text-content-primary">
            {`${staffName(action.agent_role)} · ${meta.label}`}
          </Text>
          <Text className="text-sm text-content-secondary" numberOfLines={1}>
            {summary}
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Text className="font-mono text-[10px] uppercase tracking-wider text-content-muted">
            {`TIER ${action.tier}`}
          </Text>
          <Icon name={open ? "chevron-down" : "chevron-right"} size={14} color={AI_COLORS.muted} />
        </View>
      </Pressable>

      {open ? (
        <View className="gap-3 border-t border-border-subtle px-4 py-3">
          <View className="flex-row items-center justify-between">
            <Text className="font-mono text-[10px] uppercase tracking-wider text-content-muted">
              {`TIER ${action.tier}`}
            </Text>
            <Text className="font-mono text-[10px] text-content-muted">
              {formatRelative(action.created_at)}
            </Text>
          </View>
          {action.reasoning_summary && action.reasoning_summary !== summary ? (
            <View className="flex-row items-start gap-1.5">
              <Icon name="sparkles" size={13} color={AI_COLORS.accent} />
              <Text className="flex-1 text-[13px] leading-relaxed text-content-secondary">
                {action.reasoning_summary}
              </Text>
            </View>
          ) : null}
          <ProvenanceBlock context={action.contract.context_used} />
          {link ? (
            <Pressable
              onPress={() => router.push(link.href as never)}
              className="flex-row items-center gap-1 self-start"
              accessibilityRole="link"
            >
              <Text className="font-mono text-[11px] uppercase tracking-wider text-content-accent">
                {link.label}
              </Text>
              <Icon name="arrow-right" size={12} color={AI_COLORS.accent} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
