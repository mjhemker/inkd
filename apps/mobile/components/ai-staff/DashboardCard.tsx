import { Text, View } from "react-native";
import { Badge, Card, Icon } from "@inkd/ui/native";
import { useAgentActions, useCurrentArtistProfile } from "@inkd/core/hooks";
import type { AgentActionStatus } from "@inkd/core";

import { actionTypeMeta, formatRelative, staffName } from "@/lib/aiStaff";
import { useStudioNav } from "@/components/studio/StudioNav";
import { useAiColors } from "./shared";

const STATUS_STAMP: Record<AgentActionStatus, string> = {
  proposed: "Awaiting you",
  approved: "Approved",
  executed: "Sent",
  rejected: "Dismissed",
  failed: "Failed",
  superseded: "Superseded",
};

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

/** Dashboard "AI staff activity" card — pending count + latest. Taps switch to
 * the AI staff segment in place (or push /studio/ai from outside the Studio
 * screen). Degrades to a calm prompt when there's nothing (or no DB). */
export function AiStaffDashboardCard() {
  const AI_COLORS = useAiColors();
  const goToSegment = useStudioNav();
  const { data: artist } = useCurrentArtistProfile();
  const actionsQ = useAgentActions(artist?.id, { limit: 8 });
  const actions = actionsQ.data ?? [];
  const pending = actions.filter((a) => a.status === "proposed").length;
  const latest = actions.slice(0, 3);

  return (
    <Card padding="none" variant="interactive" onPress={() => goToSegment("ai")} className="overflow-hidden">
      <View className="flex-row items-center justify-between border-b border-border-subtle px-4 py-3">
        <View className="flex-row items-center gap-2">
          <Icon name="sparkles" size={18} color={AI_COLORS.accent} />
          <Text className="font-sans text-base font-semibold text-content-primary">
            AI staff activity
          </Text>
        </View>
        {pending > 0 ? (
          <Badge variant="stamp" size="sm">{`${pending} awaiting`}</Badge>
        ) : (
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
            const line =
              action.contract.draft_text ??
              (action.contract.proposed_slots?.length
                ? `${action.contract.proposed_slots.length} times proposed`
                : action.reasoning_summary ?? meta.blurb);
            return (
              <View key={action.id} className="flex-row items-center gap-3 border-b border-border-subtle px-4 py-3">
                <StatusStamp status={action.status} />
                <View className="flex-1 gap-0.5">
                  <Text className="font-mono text-[11px] uppercase tracking-wider text-content-primary">
                    {`${staffName(action.agent_role)} · ${meta.label}`}
                  </Text>
                  <Text className="text-sm text-content-secondary" numberOfLines={1}>
                    {line}
                  </Text>
                </View>
                <Text className="font-mono text-[10px] text-content-muted">
                  {formatRelative(action.created_at)}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </Card>
  );
}
