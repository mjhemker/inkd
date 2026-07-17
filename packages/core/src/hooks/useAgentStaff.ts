/**
 * Hooks: the AI staff trust surfaces (SPEC §5) — the approvals inbox, the
 * "every move visible" activity ledger, and the playbook knowledge base.
 *
 * Realtime follows the notifications pattern (`./useNotifications.ts`): a
 * single channel per artist invalidates the affected queries as the runtime
 * inserts proposals or the artist approves/rejects them. Reads normalize every
 * row through `toAgentActionView` so screens consume the contract shape.
 */
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  approveAgentAction,
  countProposedAgentActions,
  getAgentActionTriggerMessage,
  listAgentActions,
  rejectAgentAction,
  subscribeToAgentActions,
  type AgentActionView,
  type ApproveAgentActionInput,
  type ListAgentActionsOpts,
} from "../api/agentActions";
import {
  createPlaybookEntry,
  listPlaybooks,
} from "../api/agentSettings";
import {
  deletePlaybookEntry,
  updatePlaybookEntry,
} from "../api/playbooks";
import { useInkdClient } from "./context";

const agentActionsKey = (artistId: string) =>
  ["agentActions", artistId] as const;
const playbooksKey = (artistId: string) => ["playbooks", artistId] as const;

/**
 * Wire the single realtime channel for an artist's agent_actions. Any insert or
 * status change invalidates every agent_actions query (inbox + activity feed +
 * pending count) so all views settle to the truth. Deduped by artistId.
 */
function useAgentActionsRealtime(artistId: string | undefined) {
  const client = useInkdClient();
  const qc = useQueryClient();
  useEffect(() => {
    if (!artistId) return;
    const unsubscribe = subscribeToAgentActions(client, artistId, () => {
      void qc.invalidateQueries({ queryKey: agentActionsKey(artistId) });
    });
    return unsubscribe;
    // `qc` is stable; re-subscribe only when client or artist changes.
  }, [client, artistId]);
}

/**
 * Agent actions for an artist, optionally filtered by status/type. Powers both
 * the approvals inbox (`{ status: "proposed" }`) and the activity feed (no
 * filter, or filtered). Live via the shared realtime channel.
 */
export function useAgentActions(
  artistId: string | undefined,
  opts: ListAgentActionsOpts = {},
) {
  const client = useInkdClient();
  const { status, type, limit } = opts;
  useAgentActionsRealtime(artistId);
  return useQuery({
    queryKey: [
      ...agentActionsKey(artistId ?? ""),
      { status: status ?? null, type: type ?? null, limit: limit ?? null },
    ] as const,
    queryFn: () => listAgentActions(client, artistId as string, opts),
    enabled: Boolean(artistId),
  });
}

/** Live count of actions awaiting approval — the inbox badge + dashboard card. */
export function usePendingAgentActionsCount(artistId: string | undefined) {
  const client = useInkdClient();
  useAgentActionsRealtime(artistId);
  return useQuery({
    queryKey: [...agentActionsKey(artistId ?? ""), "pendingCount"] as const,
    queryFn: () => countProposedAgentActions(client, artistId as string),
    enabled: Boolean(artistId),
  });
}

export function useApproveAgentAction(artistId: string | undefined) {
  const client = useInkdClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ApproveAgentActionInput) =>
      approveAgentAction(client, input),
    onSuccess: () => {
      if (artistId)
        void qc.invalidateQueries({ queryKey: agentActionsKey(artistId) });
    },
  });
}

export function useRejectAgentAction(artistId: string | undefined) {
  const client = useInkdClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { actionId: string; reason?: string }) =>
      rejectAgentAction(client, vars.actionId, { reason: vars.reason }),
    onSuccess: () => {
      if (artistId)
        void qc.invalidateQueries({ queryKey: agentActionsKey(artistId) });
    },
  });
}

/** The inbound client message an action responds to (approval-card context). */
export function useAgentActionTriggerMessage(
  action: AgentActionView | undefined,
) {
  const client = useInkdClient();
  return useQuery({
    queryKey: ["agentActionTrigger", action?.id ?? ""] as const,
    queryFn: () => getAgentActionTriggerMessage(client, action as AgentActionView),
    enabled: Boolean(action && action.contract.trigger.kind === "message"),
  });
}

// ── Playbook ─────────────────────────────────────────────────────────────────

export function usePlaybooks(artistId: string | undefined) {
  const client = useInkdClient();
  return useQuery({
    queryKey: playbooksKey(artistId ?? ""),
    queryFn: () => listPlaybooks(client, artistId as string),
    enabled: Boolean(artistId),
  });
}

export function useCreatePlaybook(artistId: string | undefined) {
  const client = useInkdClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof createPlaybookEntry>[2]) =>
      createPlaybookEntry(client, artistId as string, input),
    onSuccess: () => {
      if (artistId)
        void qc.invalidateQueries({ queryKey: playbooksKey(artistId) });
    },
  });
}

export function useUpdatePlaybook(artistId: string | undefined) {
  const client = useInkdClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      id: string;
      input: Parameters<typeof updatePlaybookEntry>[2];
    }) => updatePlaybookEntry(client, vars.id, vars.input),
    onSuccess: () => {
      if (artistId)
        void qc.invalidateQueries({ queryKey: playbooksKey(artistId) });
    },
  });
}

export function useDeletePlaybook(artistId: string | undefined) {
  const client = useInkdClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletePlaybookEntry(client, id),
    onSuccess: () => {
      if (artistId)
        void qc.invalidateQueries({ queryKey: playbooksKey(artistId) });
    },
  });
}
