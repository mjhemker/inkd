/**
 * Instagram connect handoff for Expo (guide §3.C mobile) + the onboarding
 * round-trip helpers.
 *
 * REDIRECT STRATEGY (chosen from app.json inspection):
 *   app.json declares `scheme: "inkd"` but NO universal/app links
 *   (no iOS associatedDomains, no Android intentFilters). The deployed
 *   `instagram-oauth-callback` 302s to `${PUBLIC_APP_URL||"https://getinkd.co"}
 *   /studio/settings` — an https URL that this app does NOT own as an
 *   associated domain, so ASWebAuthenticationSession can't reliably intercept
 *   it. Therefore:
 *     • redirectUrl = the web settings URL (best-effort match to the callback's
 *       real landing; harmless if the session never auto-closes on it), and
 *     • the FALLBACK is authoritative and ALWAYS runs: whenever the auth
 *       session resolves/closes for ANY reason (success, cancel, dismiss,
 *       stranded-on-IG-profile, ~2s skip-consent), we immediately re-poll
 *       `instagram-status` and reflect the true server state.
 *   The authorize URL is fetched FRESH on every tap (guide §7) — never cached.
 */
import { useCallback, useState } from "react";
import * as WebBrowser from "expo-web-browser";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQueryClient } from "@tanstack/react-query";
import { useInkdClient } from "@inkd/core/hooks";

import {
  InstagramError,
  getStatus,
  instagramKeys,
  startOAuth,
  type InstagramStatus,
} from "./instagram";

/** Mirrors the edge-function callback base (`PUBLIC_APP_URL`). */
const APP_URL = (process.env.EXPO_PUBLIC_APP_URL ?? "https://getinkd.co").replace(/\/$/, "");
export const INSTAGRAM_RETURN_PATH = "/studio/settings";
/** Where the auth session watches for the flow to land (the callback's target). */
export const INSTAGRAM_REDIRECT_URL = `${APP_URL}${INSTAGRAM_RETURN_PATH}`;

export type ConnectOutcome =
  | { ok: true; status: InstagramStatus }
  | { ok: false; reason: "not_connected" | "error"; message?: string; status?: InstagramStatus };

export interface UseInstagramConnectResult {
  connect: () => Promise<ConnectOutcome>;
  connecting: boolean;
}

/**
 * Runs the full connect handoff and returns the TRUE post-flow status.
 * Callers decide what to do with the outcome (settings just reflects it;
 * onboarding pushes the picker on success).
 *
 * @param artistId used to seed the freshly-polled status into the query cache.
 * @param returnTo optional relative in-app path for the callback (§6.2).
 */
export function useInstagramConnect(
  artistId: string | undefined,
  returnTo?: string,
): UseInstagramConnectResult {
  const client = useInkdClient();
  const qc = useQueryClient();
  const [connecting, setConnecting] = useState(false);

  const connect = useCallback(async (): Promise<ConnectOutcome> => {
    setConnecting(true);
    try {
      // 1. Mint a FRESH authorize URL every tap (15-min state expiry, guide §7).
      const { url } = await startOAuth(client, returnTo ? { returnTo } : {});

      // 2. Open the auth session. We deliberately ignore the *result type*:
      //    consent may auto-skip (~2s), the user may cancel, or IG may strand
      //    them on their profile without redirecting. In every case the true
      //    outcome is on the server — so we always poll next.
      try {
        await WebBrowser.openAuthSessionAsync(url, INSTAGRAM_REDIRECT_URL);
      } catch {
        /* session failed to open/close cleanly — poll anyway */
      } finally {
        // Some platforms need the modal fully torn down before the next open.
        WebBrowser.maybeCompleteAuthSession();
      }

      // 3. FALLBACK (authoritative): re-poll status and reflect reality.
      const status = await getStatus(client);
      if (artistId) qc.setQueryData(instagramKeys.status(artistId), status);

      if (status.state === "connected" || status.state === "tokenExpired") {
        // tokenExpired here means a stale row still exists but a fresh connect
        // succeeded-ish; treat "connected" as the only true success.
        if (status.connected && !status.tokenExpired) return { ok: true, status };
      }
      return { ok: false, reason: "not_connected", status };
    } catch (err) {
      const message =
        err instanceof InstagramError || err instanceof Error
          ? err.message
          : "Couldn't connect to Instagram.";
      return { ok: false, reason: "error", message };
    } finally {
      setConnecting(false);
    }
  }, [client, qc, artistId, returnTo]);

  return { connect, connecting };
}

// ===========================================================================
// Onboarding round-trip persistence (guide §3.A: resume flag survives the trip)
// ===========================================================================

const RESUME_KEY = "inkd-ig-onboarding-resume"; // stored step index (string)
const RESULT_KEY = "inkd-ig-import-result"; // stored piece count (string)

/** Stash the onboarding step before leaving for connect/picker so a full
 *  remount resumes in place. */
export async function stashOnboardingResume(step: number): Promise<void> {
  try {
    await AsyncStorage.setItem(RESUME_KEY, String(step));
  } catch {
    /* storage unavailable — onboarding falls back to artist.onboarding_step */
  }
}

/** Read (and clear) a stashed onboarding step, if any. */
export async function consumeOnboardingResume(): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(RESUME_KEY);
    if (raw == null) return null;
    await AsyncStorage.removeItem(RESUME_KEY);
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/** Record how many pieces an import added, for the surface it returns to. */
export async function stashImportResult(pieces: number): Promise<void> {
  try {
    await AsyncStorage.setItem(RESULT_KEY, String(pieces));
  } catch {
    /* non-fatal */
  }
}

/** Read (and clear) the last import's piece count. */
export async function consumeImportResult(): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(RESULT_KEY);
    if (raw == null) return null;
    await AsyncStorage.removeItem(RESULT_KEY);
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}
