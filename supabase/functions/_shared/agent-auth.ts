// Shared bearer-token auth for the AI-runtime edge functions (agent-run,
// agent-scheduled). Both are invoked every minute by pg_cron with a bearer
// token; the gateway sets verify_jwt = false (config.toml) so each function
// enforces the token itself.
//
// PREFERRED: a short dedicated shared token in the AGENT_RUNNER_TOKEN env var.
// The cron sends it (its value lives in the vault secret
// `agent_runner_service_key`) and we compare it byte-for-byte. This replaces
// the previous scheme, which required pasting the full ~219-char service-role
// JWT into the vault — fragile and easy to corrupt.
//
// BACK-COMPAT FALLBACK: the full SUPABASE_SERVICE_ROLE_KEY is still accepted so
// an operator invoking the function by hand with the service key (or an
// un-migrated cron) keeps working. AGENT_RUNNER_TOKEN wins when both are set.

/** Extract the raw bearer token from an Authorization header ("" when absent). */
export function extractBearer(req: Request): string {
  return (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
}

/**
 * True when the request carries a valid AI-runtime bearer token.
 *
 * Accepts AGENT_RUNNER_TOKEN (preferred, when set and non-empty) OR the
 * service-role key (fallback). A missing/empty bearer is always rejected.
 *
 * `getEnv` is injectable for offline tests; it defaults to Deno.env.get.
 */
export function isAuthorizedRunner(
  req: Request,
  getEnv: (k: string) => string | undefined = (k) => Deno.env.get(k),
): boolean {
  const bearer = extractBearer(req);
  if (!bearer) return false;

  const runnerToken = getEnv("AGENT_RUNNER_TOKEN");
  if (runnerToken && runnerToken.trim() !== "" && bearer === runnerToken) {
    return true;
  }

  const serviceKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (serviceKey && serviceKey.trim() !== "" && bearer === serviceKey) {
    return true;
  }

  return false;
}
