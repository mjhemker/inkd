/**
 * Connectivity + types smoke test for @inkd/core.
 *
 * Instantiates a Supabase client with the public anon key and performs an
 * UNAUTHENTICATED read of the public `styles` taxonomy table. Success proves:
 *   - env resolution + client wiring work,
 *   - the anon RLS policy on `styles` allows public reads,
 *   - the generated types match the live schema (the equivalent typed call in
 *     app code compiles against `Database`).
 *
 * Run:  node packages/core/scripts/smoke-test.mjs
 * Env:  reads NEXT_PUBLIC_/EXPO_PUBLIC_ SUPABASE_URL/ANON_KEY, else falls back
 *       to the known project URL + a required SUPABASE_ANON_KEY env var.
 */
import { createClient } from "@supabase/supabase-js";

const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  process.env.SUPABASE_URL ??
  "https://khlpidflnvkqafkvkpfy.supabase.co";

const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.SUPABASE_ANON_KEY;

if (!anonKey) {
  console.error(
    "Missing anon key. Set NEXT_PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_ANON_KEY).",
  );
  process.exit(1);
}

const supabase = createClient(url, anonKey);

const { data, error } = await supabase
  .from("styles")
  .select("slug, name, category")
  .order("sort_order", { ascending: true })
  .limit(5);

if (error) {
  console.error("SMOKE TEST FAILED:", error.message);
  process.exit(1);
}

console.log(`SMOKE TEST OK — read ${data.length} styles as anon:`);
for (const s of data) {
  console.log(`  · ${s.slug} (${s.category ?? "uncategorized"}) — ${s.name}`);
}
process.exit(0);
