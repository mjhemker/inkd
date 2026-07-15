/**
 * Onboarding hook: seed the artist's starter playbook from the data they entered
 * during onboarding (SPEC §3 → §5). Idempotent — if any onboarding-sourced
 * playbook rows already exist for the artist, it does nothing, so re-running the
 * final onboarding step never duplicates entries.
 *
 * Called best-effort from setOnboardingStep(..., { completed: true }); a failure
 * here must never block onboarding completion.
 */
import type { InkdSupabaseClient } from "../supabase/client";
import type { AgentPlaybook } from "../types/rows";
import { draftPlaybookEntries, type PlaybookDraftInput } from "./playbookDraft";

export async function seedOnboardingPlaybook(
  client: InkdSupabaseClient,
  artistId: string,
): Promise<AgentPlaybook[]> {
  // Idempotency guard: skip if we've already seeded from onboarding.
  const { count, error: countError } = await client
    .from("agent_playbooks")
    .select("id", { count: "exact", head: true })
    .eq("artist_id", artistId)
    .eq("source", "onboarding");
  if (countError) throw countError;
  if ((count ?? 0) > 0) return [];

  const [artistRes, servicesRes, policyRes, locationsRes, rulesRes] = await Promise.all([
    client.from("artist_profiles").select("tagline").eq("id", artistId).maybeSingle(),
    client
      .from("services")
      .select(
        "name, price_type, price_cents, deposit_type, deposit_amount_cents, deposit_percent, duration_minutes, is_public",
      )
      .eq("artist_id", artistId),
    client
      .from("booking_policies")
      .select("booking_window, min_notice_hours, require_medical_disclosure")
      .eq("artist_id", artistId)
      .maybeSingle(),
    client
      .from("studio_locations")
      .select("name, city, state, is_public")
      .eq("artist_id", artistId),
    client
      .from("availability_rules")
      .select("weekday, start_time, end_time, is_open")
      .eq("artist_id", artistId),
  ]);

  const input: PlaybookDraftInput = {
    artist: artistRes.data ? { tagline: artistRes.data.tagline } : null,
    services: servicesRes.data ?? [],
    bookingPolicy: policyRes.data ?? null,
    locations: locationsRes.data ?? [],
    availabilityRules: rulesRes.data ?? [],
  };

  const entries = draftPlaybookEntries(input);
  if (entries.length === 0) return [];

  const rows = entries.map((e) => ({
    artist_id: artistId,
    title: e.title,
    category: e.category,
    content: e.content,
    source: e.source,
    priority: e.priority,
  }));

  const { data, error } = await client.from("agent_playbooks").insert(rows).select("*");
  if (error) throw error;
  return data ?? [];
}
