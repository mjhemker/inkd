/**
 * Platform-neutral auth operations. Each takes an INKD Supabase client (from
 * whichever platform helper created it) plus validated input. Works identically
 * on web (ssr client) and mobile (native client).
 */
import type { Session, User, AuthError } from "@supabase/supabase-js";

import type { InkdSupabaseClient } from "../supabase/client";
import {
  signUpSchema,
  signInSchema,
  magicLinkSchema,
  resetPasswordSchema,
  type SignUpInput,
  type SignInInput,
  type MagicLinkInput,
  type ResetPasswordInput,
} from "./schemas";

export interface AuthResult {
  user: User | null;
  session: Session | null;
  error: AuthError | null;
}

/** Email + password sign-up. `displayName` and `accountType` are stored in user
 * metadata and picked up by the `handle_new_user` trigger to seed
 * `profiles.display_name` and `profiles.is_artist` respectively — so the choice
 * survives the email-confirmation round-trip. */
export async function signUpWithPassword(
  client: InkdSupabaseClient,
  input: SignUpInput,
  opts: { emailRedirectTo?: string } = {},
): Promise<AuthResult> {
  const { email, password, displayName, accountType } = signUpSchema.parse(input);
  const metadata: Record<string, string> = {};
  if (displayName) metadata.display_name = displayName;
  // Always stamp an explicit account_type so the trigger is deterministic;
  // default to "client" when the caller doesn't specify one.
  metadata.account_type = accountType ?? "client";
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: opts.emailRedirectTo,
      data: metadata,
    },
  });
  return { user: data.user, session: data.session, error };
}

/** Email + password sign-in. */
export async function signInWithPassword(
  client: InkdSupabaseClient,
  input: SignInInput,
): Promise<AuthResult> {
  const { email, password } = signInSchema.parse(input);
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });
  return { user: data.user, session: data.session, error };
}

/** Passwordless magic-link / email OTP. Sends an email; there is no session
 * until the user clicks through and the callback exchanges the code. */
export async function signInWithMagicLink(
  client: InkdSupabaseClient,
  input: MagicLinkInput,
): Promise<{ error: AuthError | null }> {
  const { email, emailRedirectTo, shouldCreateUser } =
    magicLinkSchema.parse(input);
  const { error } = await client.auth.signInWithOtp({
    email,
    options: { emailRedirectTo, shouldCreateUser },
  });
  return { error };
}

/** Send a password-reset email. */
export async function sendPasswordReset(
  client: InkdSupabaseClient,
  input: ResetPasswordInput,
): Promise<{ error: AuthError | null }> {
  const { email, redirectTo } = resetPasswordSchema.parse(input);
  const { error } = await client.auth.resetPasswordForEmail(email, {
    redirectTo,
  });
  return { error };
}

export async function signOut(
  client: InkdSupabaseClient,
): Promise<{ error: AuthError | null }> {
  const { error } = await client.auth.signOut();
  return { error };
}

/** Current session (from local storage / cookies). Cheap; does not hit the network. */
export async function getSession(
  client: InkdSupabaseClient,
): Promise<Session | null> {
  const { data } = await client.auth.getSession();
  return data.session;
}

/** Authenticated user, revalidated against the auth server. Prefer this over
 * `getSession().user` for trust decisions (e.g. server components, middleware). */
export async function getUser(
  client: InkdSupabaseClient,
): Promise<User | null> {
  const { data } = await client.auth.getUser();
  return data.user;
}
