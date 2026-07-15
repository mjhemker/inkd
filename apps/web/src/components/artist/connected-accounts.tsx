"use client";

import {
  Badge,
  type BadgeVariant,
  Button,
  Card,
  CardPlacard,
  Icon,
  Spinner,
  useToast,
} from "@inkd/ui/web";
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

const RUN_STATUS_VARIANT: Record<string, BadgeVariant> = {
  pending: "neutral",
  running: "brand",
  completed: "success",
  failed: "danger",
};

/**
 * Settings → "Connected accounts": Instagram connect/disconnect, connection
 * details, an "Import posts" trigger, and the import-run history. Reads the
 * same `useInstagramStatus` state as onboarding's portfolio row (see
 * identity-editor.tsx) — the "coming soon" state only ever shows while
 * Michael hasn't set the Meta app secrets (docs/instagram-integration.md §5).
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
      window.location.href = url;
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
      const more = summary.mediaSeen >= summary.postsCreated + summary.alreadyImported + summary.mediaSkipped
        && summary.mediaSeen > 0
        && summary.postsCreated + summary.alreadyImported < summary.mediaSeen;
      toast({
        title: "Instagram import ran",
        description:
          summary.postsCreated > 0
            ? `${summary.postsCreated} new ${summary.postsCreated === 1 ? "piece" : "pieces"} imported.${more ? " More to go — run it again to continue." : ""}`
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
      <div className="grid min-h-[20vh] place-items-center">
        <Spinner size={22} />
      </div>
    );
  }

  const configured = status?.configured ?? false;
  const connected = status?.connected ?? false;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h2 className="font-display text-xl font-bold tracking-tight">Connected accounts</h2>
        <p className="text-content-secondary">
          Pull your Instagram posts in as portfolio pieces automatically.
        </p>
      </div>

      <Card padding="none" className="overflow-hidden">
        <CardPlacard
          meta={
            !configured ? (
              <Badge variant="outline">Coming soon</Badge>
            ) : connected ? (
              <Badge variant="success">Connected</Badge>
            ) : (
              <Badge variant="neutral">Not connected</Badge>
            )
          }
        >
          Instagram
        </CardPlacard>

        <div className="flex flex-col gap-4 p-5">
          {!configured ? (
            <p className="text-sm text-content-secondary">
              Instagram import requires Meta app approval — coming soon. It'll show up
              here the moment it's ready, no update needed.
            </p>
          ) : connected ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-content-primary">
                    @{status?.ig_username ?? "connected"}
                  </span>
                  <span className="text-xs text-content-muted">
                    {status?.last_synced_at
                      ? `Last imported ${new Date(status.last_synced_at).toLocaleString()}`
                      : "Not imported yet."}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => void runImport()} loading={startImport.isPending}>
                    Import posts
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void disconnectAccount()}
                    loading={disconnect.isPending}
                  >
                    Disconnect
                  </Button>
                </div>
              </div>

              {runs && runs.length > 0 && (
                <div className="flex flex-col gap-2 border-t border-border-subtle pt-4">
                  <span className="text-xs font-medium uppercase tracking-wide text-content-muted">
                    Import history
                  </span>
                  <div className="flex flex-col gap-1.5">
                    {runs.map((run) => (
                      <div
                        key={run.id}
                        className="flex items-center justify-between gap-3 rounded-lg bg-surface-overlay px-3 py-2 text-sm"
                      >
                        <span className="text-content-secondary">
                          {new Date(run.created_at).toLocaleString()}
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="font-mono text-xs text-content-muted">
                            {run.status === "completed"
                              ? `${run.posts_created} new · ${run.already_imported} up to date`
                              : run.status === "failed"
                                ? (run.error_message ?? "Failed")
                                : ""}
                          </span>
                          <Badge size="sm" variant={RUN_STATUS_VARIANT[run.status] ?? "neutral"}>
                            {run.status}
                          </Badge>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="max-w-md text-sm text-content-secondary">
                Connect your Instagram business/creator account to pull your posts in
                as portfolio pieces.
              </p>
              <Button size="sm" onClick={() => void connect()} loading={authorizeUrl.isPending}>
                <Icon name="image" size={14} />
                Connect Instagram
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
