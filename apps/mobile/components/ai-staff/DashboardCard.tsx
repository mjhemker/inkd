import { Text, View } from "react-native";
import { router } from "expo-router";
import { Badge, Card, Icon } from "@inkd/ui/native";
import { useAgentActions, useCurrentArtistProfile } from "@inkd/core/hooks";

import { STATUS_META, actionTypeMeta, formatRelative } from "@/lib/aiStaff";
import { AI_COLORS } from "./shared";
import { StaffNameplate } from "./StaffNameplate";

/** Dashboard "AI staff activity" card — pending count + latest, taps into
 * /studio/ai. Degrades to a calm prompt when there's nothing (or no DB). */
export function AiStaffDashboardCard() {
  const { data: artist } = useCurrentArtistProfile();
  const actionsQ = useAgentActions(artist?.id, { limit: 8 });
  const actions = actionsQ.data ?? [];
  const pending = actions.filter((a) => a.status === "proposed").length;
  const latest = actions.slice(0, 3);

  return (
    <Card padding="none" variant="interactive" onPress={() => router.push("/studio/ai")} className="overflow-hidden">
      <View className="flex-row items-center justify-between border-b border-border-subtle px-4 py-3">
        <View className="flex-row items-center gap-2">
          <Icon name="sparkles" size={18} color={AI_COLORS.accent} />
          <Text className="font-sans text-base font-semibold text-content-primary">
            AI staff activity
          </Text>
        </View>
        {pending > 0 ? <Badge variant="warning" size="sm">{`${pending} to review`}</Badge> : (
          <Icon name="chevron-right" size={16} color={AI_COLORS.muted} />
        )}
      </View>

      {latest.length === 0 ? (
        <View className="items-start gap-1 px-4 py-5">
          <Text className="text-sm font-semibold text-content-primary">Nothing to review</Text>
          <Text className="text-sm text-content-muted">
            Your Front Desk drafts replies for your approval. Everything it does shows up here.
          </Text>
        </View>
      ) : (
        <View>
          {latest.map((action) => {
            const meta = actionTypeMeta(action.action_type);
            const statusMeta = STATUS_META[action.status];
            const line =
              action.contract.draft_text ??
              (action.contract.proposed_slots?.length
                ? `${action.contract.proposed_slots.length} times proposed`
                : action.reasoning_summary ?? meta.blurb);
            return (
              <View key={action.id} className="flex-row items-start gap-3 border-b border-border-subtle px-4 py-3">
                <View className="mt-0.5 h-7 w-7 items-center justify-center rounded-sm bg-surface-overlay">
                  <Icon name={meta.icon} size={14} color={AI_COLORS.muted} />
                </View>
                <View className="flex-1 gap-0.5">
                  <View className="flex-row items-center justify-between">
                    <StaffNameplate role={action.agent_role} />
                    <Text className="font-mono text-[10px] text-content-muted">
                      {formatRelative(action.created_at)}
                    </Text>
                  </View>
                  <Text className="text-sm text-content-secondary" numberOfLines={1}>
                    {line}
                  </Text>
                </View>
                <Badge variant={statusMeta.variant} size="sm">{statusMeta.label}</Badge>
              </View>
            );
          })}
        </View>
      )}
    </Card>
  );
}
