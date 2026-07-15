/**
 * Data access: agent_playbooks mutations that complete the CRUD surface begun
 * in `./agentSettings.ts` (which owns `listPlaybooks` + `createPlaybookEntry`).
 *
 * The playbook is the per-artist knowledge base the AI staff answer from — the
 * honest boundary on what the agents "know" (SPEC §5). Artist-only under RLS.
 */
import { z } from "zod";

import type { InkdSupabaseClient } from "../supabase/client";
import type { AgentPlaybook, AgentPlaybookUpdate } from "../types/rows";
import { unwrap } from "./helpers";

const playbookUpdateFields = z.object({
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
  content: z.string().min(1).optional(),
  is_active: z.boolean().optional(),
  priority: z.number().int().optional(),
});

/** Edit an existing playbook entry (title / category / content / active / order). */
export async function updatePlaybookEntry(
  client: InkdSupabaseClient,
  id: string,
  input: z.input<typeof playbookUpdateFields>,
): Promise<AgentPlaybook> {
  const fields = playbookUpdateFields.parse(input);
  return unwrap(
    await client
      .from("agent_playbooks")
      .update(fields as AgentPlaybookUpdate)
      .eq("id", id)
      .select("*")
      .single(),
  );
}

/** Delete a playbook entry. */
export async function deletePlaybookEntry(
  client: InkdSupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await client.from("agent_playbooks").delete().eq("id", id);
  if (error) throw error;
}
