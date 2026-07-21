import { useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Button, EmptyState, Icon, Skeleton, Tabs, useToast } from "@inkd/ui/native";
import {
  useAgentActions,
  useAgentSettings,
  useApproveAgentAction,
  useCurrentArtistProfile,
  useCurrentProfile,
  useRejectAgentAction,
  type AgentActionView,
} from "@inkd/core";

import { ApprovalCard } from "@/components/ai-staff/ApprovalCard";
import { ActivityRow } from "@/components/ai-staff/ActivityRow";
import { PlaybookSection } from "@/components/ai-staff/PlaybookSection";
import { StaffOverview } from "@/components/ai-staff/StaffOverview";
import { useTheme } from "@/providers/theme";

const TAB_ITEMS = [
  { value: "approvals", label: "Approvals" },
  { value: "activity", label: "Activity" },
  { value: "playbook", label: "Playbook" },
];

/**
 * Studio → AI staff body. Header + segmented bar are owned by StudioScreen.
 * Deep links resolve here as /studio/ai?tab=…&action=… (the entry file mounts
 * StudioScreen at the `ai` segment) and this reads those params directly.
 */
export function AiStaffBody() {
  const { colors } = useTheme();
  const { toast } = useToast();
  const params = useLocalSearchParams<{ tab?: string; action?: string }>();
  const { data: profile } = useCurrentProfile();
  const { data: artist, isLoading: artistLoading } = useCurrentArtistProfile();
  const artistId = artist?.id;

  const { data: settings } = useAgentSettings(artistId ?? "");
  const proposedQ = useAgentActions(artistId, { status: "proposed" });
  const activityQ = useAgentActions(artistId, { limit: 100 });
  const approve = useApproveAgentAction(artistId);
  const reject = useRejectAgentAction(artistId);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [tab, setTab] = useState(
    TAB_ITEMS.some((t) => t.value === params.tab)
      ? (params.tab as string)
      : params.action
        ? "activity"
        : "approvals",
  );

  const proposed = proposedQ.data ?? [];

  async function handleApprove(action: AgentActionView, input: { editedDraftText?: string }) {
    setBusyId(action.id);
    try {
      await approve.mutateAsync({
        action,
        editedDraftText: input.editedDraftText,
        approverProfileId: profile?.id,
      });
      toast({ title: action.action_type === "flag.handoff" ? "Marked handled" : "Sent to your client" });
    } catch (err) {
      toast({ title: "Couldn't send", description: err instanceof Error ? err.message : "Try again.", variant: "danger" });
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(action: AgentActionView, reason?: string) {
    setBusyId(action.id);
    try {
      await reject.mutateAsync({ actionId: action.id, reason });
      toast({ title: "Dismissed" });
    } catch (err) {
      toast({ title: "Couldn't dismiss", description: err instanceof Error ? err.message : "Try again.", variant: "danger" });
    } finally {
      setBusyId(null);
    }
  }

  if (artistLoading) {
    return (
      <View className="gap-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-40 w-full" />
      </View>
    );
  }

  if (!artist || !artistId) {
    return (
      <EmptyState
        icon={<Icon name="sparkles" size={24} color={colors.text.muted} />}
        title="Set up your studio first"
        description="Finish onboarding and your AI staff switch on here."
        action={<Button size="sm" onPress={() => router.push("/onboarding")}>Start setup</Button>}
      />
    );
  }

  return (
    <>
      <StaffOverview settings={settings} pendingCount={proposed.length} />

      <Tabs value={tab} onValueChange={setTab} items={TAB_ITEMS} />

      {tab === "approvals" ? (
        proposedQ.isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : proposed.length === 0 ? (
          <EmptyState
            icon={<Icon name="check" size={24} color={colors.text.muted} />}
            title="You're all caught up"
            description="When your staff drafts a reply or proposes times, it lands here for your ok before anything reaches a client."
          />
        ) : (
          <View className="gap-3">
            {proposed.map((action, i) => (
              <ApprovalCard
                key={action.id}
                action={action}
                hero={i === 0}
                busy={busyId === action.id}
                onApprove={(input) => void handleApprove(action, input)}
                onReject={(reason) => void handleReject(action, reason)}
              />
            ))}
          </View>
        )
      ) : null}

      {tab === "activity" ? (
        activityQ.isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : (activityQ.data ?? []).length === 0 ? (
          <EmptyState
            icon={<Icon name="clock" size={22} color={colors.text.muted} />}
            title="Nothing logged yet"
            description="Every reply, proposed time and handoff your staff makes will appear here — with the reason and the data behind it."
          />
        ) : (
          <View className="gap-2.5">
            {(activityQ.data ?? []).map((action) => (
              <ActivityRow
                key={action.id}
                action={action}
                highlighted={action.id === params.action}
              />
            ))}
          </View>
        )
      ) : null}

      {tab === "playbook" ? <PlaybookSection artistId={artistId} /> : null}
    </>
  );
}
