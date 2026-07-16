// Offline tests for the AI-runtime bearer auth helper. No network.
//   node --test supabase/functions/_shared/agent-auth.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { extractBearer, isAuthorizedRunner } from "./agent-auth.ts";

const TOKEN = "abc123deadbeef";
const SERVICE_KEY = "eyJ.super.long.service.role.jwt";

function reqWith(bearer: string | null): Request {
  const headers: Record<string, string> = {};
  if (bearer !== null) headers["Authorization"] = `Bearer ${bearer}`;
  return new Request("https://x/functions/v1/agent-run", { method: "POST", headers });
}

test("extractBearer: strips the Bearer prefix and trims", () => {
  assert.equal(extractBearer(reqWith("  tok  ".trim())), "tok");
  assert.equal(extractBearer(reqWith(null)), "");
});

test("isAuthorizedRunner: accepts AGENT_RUNNER_TOKEN (preferred)", () => {
  const env: Record<string, string> = { AGENT_RUNNER_TOKEN: TOKEN, SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY };
  assert.equal(isAuthorizedRunner(reqWith(TOKEN), (k) => env[k]), true);
});

test("isAuthorizedRunner: accepts the service-role key as back-compat fallback", () => {
  const env: Record<string, string> = { AGENT_RUNNER_TOKEN: TOKEN, SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY };
  assert.equal(isAuthorizedRunner(reqWith(SERVICE_KEY), (k) => env[k]), true);
});

test("isAuthorizedRunner: service-role key alone still works when AGENT_RUNNER_TOKEN unset", () => {
  const env: Record<string, string> = { SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY };
  assert.equal(isAuthorizedRunner(reqWith(SERVICE_KEY), (k) => env[k]), true);
});

test("isAuthorizedRunner: token bearer with AGENT_RUNNER_TOKEN unset → rejected (the pre-secret state)", () => {
  const env: Record<string, string> = { SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY };
  assert.equal(isAuthorizedRunner(reqWith(TOKEN), (k) => env[k]), false);
});

test("isAuthorizedRunner: empty AGENT_RUNNER_TOKEN is ignored (does not match empty bearer)", () => {
  const env: Record<string, string> = { AGENT_RUNNER_TOKEN: "   ", SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY };
  assert.equal(isAuthorizedRunner(reqWith(""), (k) => env[k]), false);
  assert.equal(isAuthorizedRunner(reqWith("   "), (k) => env[k]), false);
});

test("isAuthorizedRunner: wrong bearer → rejected", () => {
  const env: Record<string, string> = { AGENT_RUNNER_TOKEN: TOKEN, SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY };
  assert.equal(isAuthorizedRunner(reqWith("nope"), (k) => env[k]), false);
});

test("isAuthorizedRunner: missing Authorization header → rejected", () => {
  const env: Record<string, string> = { AGENT_RUNNER_TOKEN: TOKEN, SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY };
  assert.equal(isAuthorizedRunner(reqWith(null), (k) => env[k]), false);
});
