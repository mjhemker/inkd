/**
 * Data access: agent_settings (autonomy slider + per-action-class overrides)
 * and agent_playbooks. Agent internals are artist-only under RLS (SPEC §5).
 *
 * The agent runtime + agent_actions audit writes happen server-side (service
 * role) in a later phase; here we expose only the artist-facing configuration.
 */
import { z } from "zod";

import type { InkdSupabaseClient } from "../supabase/client";
import type {
  AgentSettings,
  AgentSettingsInsert,
  AgentPlaybook,
} from "../types/rows";
import { unwrap, unwrapList, unwrapMaybe } from "./helpers";

export async function getAgentSettings(
  client: InkdSupabaseClient,
  artistId: string,
): Promise<AgentSettings | null> {
  return unwrapMaybe(
    await client
      .from("agent_settings")
      .select("*")
      .eq("artist_id", artistId)
      .maybeSingle(),
  );
}

const settingsFields = z.object({
  autonomy: z
    .enum(["no_ai", "draft_only", "assisted", "managed"])
    .optional(),
  action_class_overrides: z.record(z.unknown()).optional(),
  front_desk_enabled: z.boolean().optional(),
  booking_manager_enabled: z.boolean().optional(),
  studio_manager_enabled: z.boolean().optional(),
  growth_advisor_enabled: z.boolean().optional(),
  client_disclosure_enabled: z.boolean().optional(),
  escalation_keywords: z.array(z.string()).optional(),
  quote_min_cents: z.number().int().nonnegative().nullable().optional(),
  quote_max_cents: z.number().int().nonnegative().nullable().optional(),
});

/** Create-or-update the artist's single agent_settings row. Defaults to
 * `draft_only` autonomy per SPEC §5 (safe default for new accounts). */
export async function upsertAgentSettings(
  client: InkdSupabaseClient,
  artistId: string,
  input: z.input<typeof settingsFields>,
): Promise<AgentSettings> {
  const fields = settingsFields.parse(input);
  const row: AgentSettingsInsert = {
    artist_id: artistId,
    ...fields,
    action_class_overrides:
      fields.action_class_overrides as AgentSettingsInsert["action_class_overrides"],
  };
  return unwrap(
    await client
      .from("agent_settings")
      .upsert(row, { onConflict: "artist_id" })
      .select("*")
      .single(),
  );
}

export async function listPlaybooks(
  client: InkdSupabaseClient,
  artistId: string,
): Promise<AgentPlaybook[]> {
  return unwrapList(
    await client
      .from("agent_playbooks")
      .select("*")
      .eq("artist_id", artistId)
      .order("priority", { ascending: false }),
  );
}

const playbookFields = z.object({
  title: z.string().max(200).nullable().optional(),
  category: z
    .enum([
      "faq",
      "tone",
      "policy",
      "pricing",
      "aftercare",
      "scheduling",
      "other",
    ])
    .optional(),
  content: z.string().min(1),
  source: z.enum(["onboarding", "manual", "agent_suggested"]).optional(),
  is_active: z.boolean().optional(),
  priority: z.number().int().optional(),
});

export async function createPlaybookEntry(
  client: InkdSupabaseClient,
  artistId: string,
  input: z.input<typeof playbookFields>,
): Promise<AgentPlaybook> {
  const fields = playbookFields.parse(input);
  return unwrap(
    await client
      .from("agent_playbooks")
      .insert({ artist_id: artistId, ...fields })
      .select("*")
      .single(),
  );
}
