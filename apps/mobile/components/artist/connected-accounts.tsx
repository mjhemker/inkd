import { useState } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Button, Card, CardPlacard, Modal, Spinner, useToast } from "@inkd/ui/native";
import type { ArtistProfile } from "@inkd/core";

import { useInstagramStatus, useInstagramDisconnect } from "@/lib/instagram";
import { useInstagramConnect } from "@/lib/instagramConnect";

export interface ConnectedAccountsEditorProps {
  artist: ArtistProfile;
}

const PROFESSIONAL_REQUIREMENT =
  "Requires an Instagram Business or Creator account — free to switch in Instagram → Settings → Account type.";
const READ_ONLY_TRUST =
  "We import only the posts you choose. We never post, message, or change anything on your Instagram.";

/** "last synced …" relative label. */
function syncedAgo(iso: string | null): string {
  if (!iso) return "not imported yet";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "recently";
  const mins = Math.floor((Date.now() - then) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

/**
 * Settings → Sharing → "Connected accounts" (mobile). Four server-derived
 * states (guide §3.B): coming soon / not connected / connected / token
 * expired. Selection-based import happens on the picker screen; this section
 * only connects, shows state, and disconnects.
 */
export function ConnectedAccountsEditor({ artist }: ConnectedAccountsEditorProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { data: status, isLoading } = useInstagramStatus(artist.id);
  const { connect, connecting } = useInstagramConnect(artist.id);
  const disconnect = useInstagramDisconnect(artist.id);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function handleConnect() {
    const outcome = await connect();
    if (outcome.ok) {
      toast({
        title: `Connected as @${outcome.status.igUsername ?? "instagram"}`,
        variant: "success",
      });
    } else if (outcome.reason === "error") {
      toast({
        title: "Couldn't connect to Instagram",
        description: outcome.message ?? "Try again.",
        variant: "danger",
      });
    }
    // reason "not_connected" (cancelled / stranded) → quiet; state reflects it.
  }

  async function handleDisconnect() {
    try {
      await disconnect.mutateAsync();
      setConfirmOpen(false);
      toast({ title: "Instagram disconnected", variant: "success" });
    } catch (err) {
      toast({
        title: "Couldn't disconnect",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "danger",
      });
    }
  }

  const state = status?.state ?? "notConnected";
  const placardLabel =
    state === "comingSoon"
      ? "Coming soon"
      : state === "connected"
        ? "Connected"
        : state === "tokenExpired"
          ? "Reconnect"
          : "Not connected";

  return (
    <View className="gap-6">
      <View className="gap-1.5">
        <Text className="font-display text-xl text-content-primary">Connected accounts</Text>
        <Text className="text-content-secondary">
          Pull your Instagram posts in as portfolio pieces — you choose which ones.
        </Text>
      </View>

      <Card padding="none">
        <CardPlacard meta={placardLabel}>Instagram</CardPlacard>

        <View className="gap-4 p-4">
          {isLoading ? (
            <View className="items-center py-6">
              <Spinner size="large" />
            </View>
          ) : state === "comingSoon" ? (
            <Text className="text-sm text-content-secondary">
              Instagram import requires Meta app approval — coming soon. It&apos;ll show up here
              the moment it&apos;s ready, no update needed.
            </Text>
          ) : state === "connected" ? (
            <View className="gap-4">
              <View className="flex-row flex-wrap items-center justify-between gap-3">
                <View className="gap-0.5">
                  <Text className="text-sm font-sans-semibold text-content-primary">
                    @{status?.igUsername ?? "connected"}
                  </Text>
                  <Text className="text-xs text-content-muted">
                    Last synced {syncedAgo(status?.lastSyncedAt ?? null)}
                  </Text>
                </View>
                <View className="flex-row gap-2">
                  <Button
                    size="sm"
                    onPress={() => router.push("/instagram/import?origin=settings" as never)}
                  >
                    Import posts
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onPress={() => setConfirmOpen(true)}
                    loading={disconnect.isPending}
                  >
                    Disconnect
                  </Button>
                </View>
              </View>
              <Text className="text-xs text-content-muted">{READ_ONLY_TRUST}</Text>
            </View>
          ) : state === "tokenExpired" ? (
            <View className="gap-3">
              <Text className="text-sm text-content-secondary">
                Your Instagram connection expired. Reconnect to keep importing your posts.
              </Text>
              <Button
                size="sm"
                onPress={() => void handleConnect()}
                loading={connecting}
                className="self-start"
              >
                Reconnect Instagram
              </Button>
            </View>
          ) : (
            // notConnected (and forbidden/error fall through here honestly)
            <View className="gap-3">
              <Text className="text-sm text-content-secondary">{READ_ONLY_TRUST}</Text>
              <Text className="text-xs text-content-muted">{PROFESSIONAL_REQUIREMENT}</Text>
              <Button
                size="sm"
                onPress={() => void handleConnect()}
                loading={connecting}
                className="self-start"
              >
                Connect Instagram
              </Button>
            </View>
          )}
        </View>
      </Card>

      <Modal
        open={confirmOpen}
        onClose={() => (disconnect.isPending ? undefined : setConfirmOpen(false))}
        title="Disconnect Instagram?"
        description="We'll remove the connection. The posts you already imported stay in your portfolio."
        footer={
          <View className="flex-row justify-end gap-2">
            <Button variant="ghost" onPress={() => setConfirmOpen(false)} disabled={disconnect.isPending}>
              Cancel
            </Button>
            <Button variant="outline" onPress={() => void handleDisconnect()} loading={disconnect.isPending}>
              Disconnect
            </Button>
          </View>
        }
      />
    </View>
  );
}
