/** Hooks: agent_settings (autonomy slider + per-action-class overrides). */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getAgentSettings,
  upsertAgentSettings,
} from "../api/agentSettings";
import type { AgentSettings } from "../types/rows";
import { useInkdClient } from "./context";

const agentSettingsKey = (artistId: string) =>
  ["agentSettings", artistId] as const;

export function useAgentSettings(artistId: string) {
  const client = useInkdClient();
  return useQuery({
    queryKey: agentSettingsKey(artistId),
    queryFn: () => getAgentSettings(client, artistId),
    enabled: Boolean(artistId),
  });
}

export function useUpsertAgentSettings(artistId: string) {
  const client = useInkdClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof upsertAgentSettings>[2]) =>
      upsertAgentSettings(client, artistId, input),
    onSuccess: (settings: AgentSettings) =>
      qc.setQueryData(agentSettingsKey(artistId), settings),
  });
}
