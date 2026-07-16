/**
 * Expo push registration helpers for the INKD mobile app.
 *
 * Push works out of the box in Expo Go / dev clients with NO extra credentials.
 * PRODUCTION standalone builds need FCM (Android) + APNs (iOS) creds wired via
 * EAS — see docs/notifications.md. `registerForPushNotificationsAsync` degrades
 * gracefully everywhere (simulator, denied permission, no projectId) by
 * returning a status instead of throwing.
 */
import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";

export type PushPlatform = "ios" | "android" | "web";

export function currentPushPlatform(): PushPlatform {
  if (Platform.OS === "ios") return "ios";
  if (Platform.OS === "android") return "android";
  return "web";
}

/**
 * Foreground presentation: show the banner + list entry, play a sound, and let
 * the OS update the badge even while the app is open. (SDK 54 field names.)
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/** Android requires an explicit high-importance channel for heads-up alerts.
 * The channel id "default" matches what the send-push payload targets. */
export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("default", {
    name: "Default",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#7C3AED",
  });
}

export interface PushRegistration {
  /** The Expo push token, or null when permission was denied / unavailable. */
  token: string | null;
  /** Permission status string ("granted" | "denied" | "undetermined"). */
  status: string;
  platform: PushPlatform;
}

/** Resolve the EAS project id (needed by getExpoPushTokenAsync on dev clients /
 * standalone builds). Null in bare Expo Go before an EAS project exists. */
function resolveProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as
    | { eas?: { projectId?: string } }
    | undefined;
  const easConfig = (Constants as { easConfig?: { projectId?: string } }).easConfig;
  return extra?.eas?.projectId ?? easConfig?.projectId ?? undefined;
}

/**
 * Ask for permission (once) and fetch the device's Expo push token. Returns null
 * on a simulator (no push hardware). Never throws for the expected "denied" /
 * "no projectId" cases — surfaces them via `status` / a null token so the caller
 * can update UI without a try/catch.
 */
export async function registerForPushNotificationsAsync(): Promise<PushRegistration> {
  const platform = currentPushPlatform();
  await ensureAndroidChannel();

  const denied: PushRegistration = { token: null, status: "denied", platform };

  if (!Device.isDevice) {
    // Simulators/emulators can't receive a real token.
    return { token: null, status: "granted", platform };
  }

  const existing = await Notifications.getPermissionsAsync();
  let status: string = existing.status;
  if (status !== "granted") {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  if (status !== "granted") return { ...denied, status };

  try {
    const projectId = resolveProjectId();
    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    return { token: tokenResponse.data, status, platform };
  } catch (err) {
    console.warn("expo push token fetch failed:", err);
    return { token: null, status, platform };
  }
}

/** Current permission status without prompting (for the Settings toggle copy). */
export async function getPushPermissionStatus(): Promise<string> {
  const perms = await Notifications.getPermissionsAsync();
  return perms.status;
}

/** Set the app-icon badge (clamped to >= 0). */
export async function setBadgeCount(count: number): Promise<void> {
  try {
    await Notifications.setBadgeCountAsync(Math.max(0, count));
  } catch {
    // Badge unsupported on some platforms — non-fatal.
  }
}
