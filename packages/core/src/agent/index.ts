// @inkd/core agent surface: the deterministic playbook auto-draft (pure) + the
// onboarding seeding hook. The agent RUNTIME itself lives server-side in
// supabase/functions/agent-run (service role); this package only exposes the
// artist-side building blocks the apps need.
export * from "./playbookDraft";
export * from "./onboardingPlaybook";
