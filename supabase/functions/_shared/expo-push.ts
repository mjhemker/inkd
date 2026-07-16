// Expo push delivery (FREE via the Expo Push API — no FCM/APNs account needed
// for Expo Go / dev clients; production standalone builds still need FCM+APNs
// creds wired through EAS, see docs/notifications.md).
//
// Pure builder + a thin sender with an injectable fetch so the payload logic is
// unit-tested offline. The dispatcher (notification-dispatch.ts) uses this to
// deliver a `push` notification_deliveries row and to prune tokens Expo reports
// as DeviceNotRegistered.

export const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
export const EXPO_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";
/** Expo caps a single /send request at 100 messages. */
export const EXPO_CHUNK_SIZE = 100;

export type PushPlatform = "ios" | "android" | "web";

export interface DeviceToken {
  token: string;
  platform: PushPlatform;
}

export interface PushContent {
  title: string;
  body: string;
  /** Arbitrary JSON delivered to the app on tap. We put the deep-link `url`
   * (the notification's action_url) + notification id here. */
  data?: Record<string, unknown>;
  /** iOS app-icon badge count to set. */
  badge?: number;
}

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  sound: "default";
  priority: "high";
  channelId: "default";
  badge?: number;
}

/** True for a syntactically valid Expo push token. Guards against sending junk
 * (and helps callers prune obviously-dead rows without a round-trip). */
export function isExpoPushToken(token: string): boolean {
  return (
    typeof token === "string" &&
    (/^ExponentPushToken\[[^\]]+\]$/.test(token) ||
      /^ExpoPushToken\[[^\]]+\]$/.test(token))
  );
}

/**
 * Build the Expo message payload array for a set of device tokens. One message
 * per (valid) token. Invalid-looking tokens are dropped up front. `channelId`
 * is always "default" — the Android channel the mobile app registers at boot.
 */
export function buildExpoPushMessages(
  tokens: DeviceToken[],
  content: PushContent,
): ExpoPushMessage[] {
  const title = content.title.trim();
  const body = content.body.trim();
  return tokens
    .filter((t) => isExpoPushToken(t.token))
    .map((t) => {
      const msg: ExpoPushMessage = {
        to: t.token,
        title,
        body,
        data: content.data ?? {},
        sound: "default",
        priority: "high",
        channelId: "default",
      };
      if (typeof content.badge === "number") msg.badge = content.badge;
      return msg;
    });
}

/** Split messages into Expo's 100-per-request chunks. */
export function chunkMessages(messages: ExpoPushMessage[]): ExpoPushMessage[][] {
  const chunks: ExpoPushMessage[][] = [];
  for (let i = 0; i < messages.length; i += EXPO_CHUNK_SIZE) {
    chunks.push(messages.slice(i, i + EXPO_CHUNK_SIZE));
  }
  return chunks;
}

export interface ExpoTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

export interface SendPushResult {
  tickets: ExpoTicket[];
  /** Tokens Expo reported as permanently invalid (DeviceNotRegistered) — the
   * dispatcher deletes these rows so we stop trying them. */
  invalidTokens: string[];
  /** True when at least one message was accepted (status ok). */
  anyOk: boolean;
}

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

/**
 * POST the messages to Expo (chunked) and reconcile tickets back to tokens so we
 * can surface DeviceNotRegistered tokens for pruning. `fetchImpl` is injectable
 * for tests; defaults to global fetch.
 */
export async function sendExpoPush(
  messages: ExpoPushMessage[],
  fetchImpl: FetchLike = ((...a: Parameters<typeof fetch>) => fetch(...a)) as FetchLike,
): Promise<SendPushResult> {
  const allTickets: ExpoTicket[] = [];
  const invalidTokens: string[] = [];

  for (const chunk of chunkMessages(messages)) {
    const res = await fetchImpl(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
      },
      body: JSON.stringify(chunk),
    });
    if (!res.ok) {
      throw new Error(`Expo push failed: ${res.status} ${await res.text()}`);
    }
    const json = (await res.json()) as { data?: ExpoTicket[] };
    const tickets = json.data ?? [];
    tickets.forEach((ticket, i) => {
      allTickets.push(ticket);
      if (
        ticket.status === "error" &&
        ticket.details?.error === "DeviceNotRegistered" &&
        chunk[i]
      ) {
        invalidTokens.push(chunk[i].to);
      }
    });
  }

  return {
    tickets: allTickets,
    invalidTokens,
    anyOk: allTickets.some((t) => t.status === "ok"),
  };
}
