import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Badge, Card, CardPlacard, Icon } from "@inkd/ui/native";
import type { AgentActionView } from "@inkd/core";

import { STATUS_META, actionTypeMeta, formatRelative } from "@/lib/aiStaff";
import { useAiColors, ProvenanceBlock, TierStamp } from "./shared";
import { StaffNameplate } from "./StaffNameplate";

function deepLink(action: AgentActionView): { href: string; label: string } | null {
  if (action.thread_id)
    return { href: `/(tabs)/messages/${action.thread_id}`, label: "Open thread" };
  if (action.booking_id)
    return { href: `/bookings/${action.booking_id}`, label: "Open booking" };
  if (action.booking_request_id)
    return { href: `/bookings/requests/${action.booking_request_id}`, label: "Open request" };
  return null;
}

/** One row of the activity ledger — what happened, why, data used, outcome. */
export function ActivityRow({
  action,
  highlighted = false,
}: {
  action: AgentActionView;
  highlighted?: boolean;
}) {
  const AI_COLORS = useAiColors();
  const meta = actionTypeMeta(action.action_type);
  const statusMeta = STATUS_META[action.status];
  const link = deepLink(action);
  const [open, setOpen] = useState(false);
  const summary =
    action.contract.draft_text ??
    (action.contract.proposed_slots?.length
      ? `${action.contract.proposed_slots.length} session time(s) proposed`
      : action.reasoning_summary ?? meta.blurb);

  return (
    <Card
      padding="none"
      className={highlighted ? "overflow-hidden border-brand" : "overflow-hidden"}
    >
      <CardPlacard meta={<Badge variant={statusMeta.variant} size="sm">{statusMeta.label}</Badge>}>
        {meta.label}
      </CardPlacard>
      <View className="gap-3 p-4">
        <View className="flex-row items-center justify-between">
          <StaffNameplate role={action.agent_role} />
          <Text className="font-mono text-[11px] text-content-muted">
            {formatRelative(action.created_at)}
          </Text>
        </View>

        <Text className="text-sm leading-relaxed text-content-secondary" numberOfLines={3}>
          {summary}
        </Text>

        <Pressable
          onPress={() => setOpen((v) => !v)}
          className="flex-row items-center gap-1.5"
          accessibilityRole="button"
        >
          <Icon name={open ? "chevron-down" : "chevron-right"} size={12} color={AI_COLORS.muted} />
          <Text className="font-mono text-[10px] uppercase tracking-widest text-content-muted">
            {`Data it used (${action.contract.context_used.length})`}
          </Text>
        </Pressable>
        {open ? <ProvenanceBlock context={action.contract.context_used} /> : null}

        <View className="flex-row items-center justify-between">
          <TierStamp tier={action.tier} withLabel={false} />
          {link ? (
            <Pressable
              onPress={() => router.push(link.href as never)}
              className="flex-row items-center gap-1"
              accessibilityRole="link"
            >
              <Text className="font-mono text-[11px] uppercase tracking-wider text-content-accent">
                {link.label}
              </Text>
              <Icon name="arrow-right" size={12} color={AI_COLORS.accent} />
            </Pressable>
          ) : null}
        </View>
      </View>
    </Card>
  );
}
