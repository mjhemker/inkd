"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Icon,
  Skeleton,
  Tabs,
  useToast,
} from "@inkd/ui/web";
import {
  useAgentActions,
  useAgentSettings,
  useApproveAgentAction,
  useCurrentArtistProfile,
  useCurrentProfile,
  useRejectAgentAction,
} from "@inkd/core/hooks";
import type { AgentActionView } from "@inkd/core";

import { ActivityFeed } from "./ActivityFeed";
import { ApprovalCard } from "./ApprovalCard";
import { PlaybookEditor } from "./PlaybookEditor";
import { StaffOverviewHeader } from "./StaffOverviewHeader";

const TABS = [
  { value: "approvals", label: "Approvals" },
  { value: "activity", label: "Activity" },
  { value: "playbook", label: "Playbook" },
];

/**
 * The AI staff area (/studio/ai): the staff overview header, then three tabbed
 * trust surfaces — the approvals inbox, the activity ledger, and the playbook
 * editor. Everything reads from the current artist's agent_actions / settings /
 * playbook under RLS, live over the shared realtime channel.
 */
export function AiStaffView() {
  const { toast } = useToast();
  const { data: profile } = useCurrentProfile();
  const { data: artist, isLoading: artistLoading } = useCurrentArtistProfile();
  const artistId = artist?.id;

  const { data: settings } = useAgentSettings(artistId ?? "");
  const proposedQ = useAgentActions(artistId, { status: "proposed" });
  const activityQ = useAgentActions(artistId, { limit: 100 });

  const approve = useApproveAgentAction(artistId);
  const reject = useRejectAgentAction(artistId);
  const [busyId, setBusyId] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const deepLinkedActionId = searchParams.get("action");
  const initialTab = TABS.some((t) => t.value === searchParams.get("tab"))
    ? (searchParams.get("tab") as string)
    : deepLinkedActionId
      ? "activity"
      : "approvals";
  const [tab, setTab] = useState(initialTab);

  if (artistLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-24 w-full rounded-sm" />
        <Skeleton className="h-64 w-full rounded-sm" />
      </div>
    );
  }

  if (!artist) {
    return (
      <Card padding="lg" className="flex flex-col items-start gap-4">
        <span className="grid h-12 w-12 place-items-center rounded-sm bg-surface-overlay text-content-accent">
          <Icon name="sparkles" size={22} />
        </span>
        <div className="flex flex-col gap-1.5">
          <h2 className="font-display text-xl font-bold tracking-tight">
            Set up your studio first
          </h2>
          <p className="max-w-md text-content-secondary">
            Finish onboarding and your AI staff — Front Desk and Booking Manager —
            switch on here.
          </p>
        </div>
        <Link href="/onboarding">
          <Button>
            Start setup
            <Icon name="arrow-right" size={16} />
          </Button>
        </Link>
      </Card>
    );
  }

  const proposed = proposedQ.data ?? [];

  async function handleApprove(
    action: AgentActionView,
    input: { editedDraftText?: string },
  ) {
    setBusyId(action.id);
    try {
      await approve.mutateAsync({
        action,
        editedDraftText: input.editedDraftText,
        approverProfileId: profile?.id,
      });
      toast({ title: action.action_type === "flag.handoff" ? "Marked handled" : "Sent to your client" });
    } catch (err) {
      toast({
        title: "Couldn't send",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "danger",
      });
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
      toast({
        title: "Couldn't dismiss",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "danger",
      });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <StaffOverviewHeader settings={settings} pendingCount={proposed.length} />

      <Tabs
        value={tab}
        onValueChange={setTab}
        className="overflow-x-auto"
        items={TABS.map((t) =>
          t.value === "approvals" && proposed.length > 0
            ? {
                ...t,
                icon: (
                  <Badge variant="warning" size="sm">
                    {proposed.length}
                  </Badge>
                ),
              }
            : t,
        )}
      />

      {tab === "approvals" && (
        <div className="flex flex-col gap-3">
          {proposedQ.isLoading ? (
            <>
              <Skeleton className="h-72 w-full rounded-sm" />
              <Skeleton className="h-72 w-full rounded-sm" />
            </>
          ) : proposed.length === 0 ? (
            <EmptyState
              className="py-16"
              icon={<Icon name="check" size={24} />}
              title="You're all caught up"
              description="When your staff drafts a reply or proposes times, it lands here for your ok before anything reaches a client."
            />
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {proposed.map((action) => (
                <ApprovalCard
                  key={action.id}
                  action={action}
                  busy={busyId === action.id}
                  onApprove={(input) => void handleApprove(action, input)}
                  onReject={(reason) => void handleReject(action, reason)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "activity" && (
        <ActivityFeed
          actions={activityQ.data ?? []}
          isLoading={activityQ.isLoading}
          highlightId={deepLinkedActionId}
        />
      )}

      {tab === "playbook" && <PlaybookEditor artistId={artist.id} />}
    </div>
  );
}
