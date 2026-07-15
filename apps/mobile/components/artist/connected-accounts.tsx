import { Linking, Text, View } from "react-native";
import { Badge, Button, Card, CardPlacard, Spinner, useToast } from "@inkd/ui/native";
import type { ArtistProfile } from "@inkd/core";
import {
  useInstagramStatus,
  useInstagramAuthorizeUrl,
  useDisconnectInstagram,
  useStartInstagramImport,
  useInstagramImportRuns,
} from "@inkd/core/hooks";

export interface ConnectedAccountsEditorProps {
  artist: ArtistProfile;
}

const RUN_STATUS_VARIANT: Record<string, "neutral" | "brand" | "success" | "danger"> = {
  pending: "neutral",
  running: "brand",
  completed: "success",
  failed: "danger",
};

/**
 * Settings → "Connected accounts" (mobile): mirrors the web
 * connected-accounts.tsx exactly — Instagram connect/disconnect, connection
 * details, an "Import posts" trigger, and the import-run history.
 */
export function ConnectedAccountsEditor({ artist }: ConnectedAccountsEditorProps) {
  const { toast } = useToast();
  const { data: status, isLoading } = useInstagramStatus(artist.id);
  const { data: runs } = useInstagramImportRuns(artist.id);
  const authorizeUrl = useInstagramAuthorizeUrl();
  const disconnect = useDisconnectInstagram(artist.id);
  const startImport = useStartInstagramImport(artist.id);

  async function connect() {
    try {
      const { url } = await authorizeUrl.mutateAsync();
      await Linking.openURL(url);
    } catch (err) {
      toast({
        title: "Couldn't start Instagram connect",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "danger",
      });
    }
  }

  async function disconnectAccount() {
    try {
      await disconnect.mutateAsync();
      toast({ title: "Instagram disconnected", variant: "success" });
    } catch (err) {
      toast({
        title: "Couldn't disconnect",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "danger",
      });
    }
  }

  async function runImport() {
    try {
      const summary = await startImport.mutateAsync();
      toast({
        title: "Instagram import ran",
        description:
          summary.postsCreated > 0
            ? `${summary.postsCreated} new ${summary.postsCreated === 1 ? "piece" : "pieces"} imported.`
            : "Everything is already imported.",
        variant: "success",
      });
    } catch (err) {
      toast({
        title: "Import failed",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "danger",
      });
    }
  }

  if (isLoading) {
    return (
      <View className="min-h-[20vh] items-center justify-center">
        <Spinner size="large" />
      </View>
    );
  }

  const configured = status?.configured ?? false;
  const connected = status?.connected ?? false;

  return (
    <View className="gap-6">
      <View className="gap-1.5">
        <Text className="font-display text-xl text-content-primary">
          Connected accounts
        </Text>
        <Text className="text-content-secondary">
          Pull your Instagram posts in as portfolio pieces automatically.
        </Text>
      </View>

      <Card padding="none">
        <CardPlacard
          meta={
            <Text className="font-mono text-[11px] uppercase tracking-widest text-content-secondary">
              {!configured ? "Coming soon" : connected ? "Connected" : "Not connected"}
            </Text>
          }
        >
          Instagram
        </CardPlacard>

        <View className="gap-4 p-4">
          {!configured ? (
            <Text className="text-sm text-content-secondary">
              Instagram import requires Meta app approval — coming soon. It&apos;ll
              show up here the moment it&apos;s ready, no update needed.
            </Text>
          ) : connected ? (
            <>
              <View className="flex-row flex-wrap items-center justify-between gap-3">
                <View>
                  <Text className="text-sm font-sans-semibold text-content-primary">
                    @{status?.ig_username ?? "connected"}
                  </Text>
                  <Text className="text-xs text-content-muted">
                    {status?.last_synced_at
                      ? `Last imported ${new Date(status.last_synced_at).toLocaleString()}`
                      : "Not imported yet."}
                  </Text>
                </View>
                <View className="flex-row gap-2">
                  <Button size="sm" onPress={() => void runImport()} loading={startImport.isPending}>
                    Import posts
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onPress={() => void disconnectAccount()}
                    loading={disconnect.isPending}
                  >
                    Disconnect
                  </Button>
                </View>
              </View>

              {runs && runs.length > 0 && (
                <View className="gap-2 border-t border-border-subtle pt-4">
                  <Text className="text-xs font-sans-medium uppercase tracking-wide text-content-muted">
                    Import history
                  </Text>
                  <View className="gap-1.5">
                    {runs.map((run) => (
                      <View
                        key={run.id}
                        className="flex-row items-center justify-between gap-3 rounded-lg bg-surface-overlay px-3 py-2"
                      >
                        <Text className="text-sm text-content-secondary">
                          {new Date(run.created_at).toLocaleDateString()}
                        </Text>
                        <View className="flex-row items-center gap-2">
                          <Text className="font-mono text-xs text-content-muted">
                            {run.status === "completed"
                              ? `${run.posts_created} new`
                              : run.status === "failed"
                                ? "failed"
                                : ""}
                          </Text>
                          <Badge size="sm" variant={RUN_STATUS_VARIANT[run.status] ?? "neutral"}>
                            {run.status}
                          </Badge>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </>
          ) : (
            <View className="gap-3">
              <Text className="text-sm text-content-secondary">
                Connect your Instagram business/creator account to pull your posts in
                as portfolio pieces.
              </Text>
              <Button
                size="sm"
                onPress={() => void connect()}
                loading={authorizeUrl.isPending}
                className="self-start"
              >
                Connect Instagram
              </Button>
            </View>
          )}
        </View>
      </Card>
    </View>
  );
}
