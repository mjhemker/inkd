"use client";

import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardPlacard,
  Modal,
  Spinner,
  useToast,
} from "@inkd/ui/web";
import type { ArtistProfile } from "@inkd/core";
import {
  useInstagramConnectionState,
  useInstagramStartOAuth,
  useInstagramDisconnect,
} from "@inkd/core/hooks";

import { InstagramImportModal } from "./instagram/InstagramImportModal";
import { InstagramGlyph } from "./instagram/glyphs";
import { formatRelativeTime } from "./instagram/relativeTime";

export interface ConnectedAccountsEditorProps {
  artist: ArtistProfile;
}

const REQUIREMENT_COPY =
  "Requires an Instagram Business or Creator account — free to switch in Instagram → Settings → Account type.";
const READ_ONLY_COPY =
  "We import only the posts you choose. We never post, message, or change anything on your Instagram.";

/**
 * Settings → "Share & connect": the Instagram section. The rendered state is
 * ALWAYS re-derived from `instagram-status` (never from the `?instagram=` URL
 * param, which only drives a one-time toast in settings-view). Four server
 * states per UI guide §3.B: not connected · connected · token expired ·
 * coming soon, plus loading/forbidden/error edges.
 */
export function ConnectedAccountsEditor({ artist }: ConnectedAccountsEditorProps) {
  const { toast } = useToast();
  const { state } = useInstagramConnectionState(artist.id);
  const startOAuth = useInstagramStartOAuth();
  const disconnect = useInstagramDisconnect(artist.id);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  async function connect(returnTo?: string) {
    try {
      // Mint a FRESH url every tap (15-min state) — never cache it.
      const { url } = await startOAuth.mutateAsync(returnTo ? { return_to: returnTo } : {});
      // Full-page redirect (never a popup — Instagram consent blocks some popup contexts).
      window.location.href = url;
    } catch (err) {
      toast({
        title: "Couldn't start Instagram connect",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "danger",
      });
    }
  }

  async function doDisconnect() {
    try {
      await disconnect.mutateAsync();
      setConfirmDisconnect(false);
      toast({ title: "Instagram disconnected", variant: "success" });
    } catch (err) {
      toast({
        title: "Couldn't disconnect",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "danger",
      });
    }
  }

  const meta = (() => {
    switch (state.kind) {
      case "connected":
        return <Badge variant="success">Connected</Badge>;
      case "tokenExpired":
        return <Badge variant="warning">Reconnect</Badge>;
      case "comingSoon":
        return <Badge variant="outline">Coming soon</Badge>;
      case "loading":
        return null;
      default:
        return <Badge variant="neutral">Not connected</Badge>;
    }
  })();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h2 className="font-display text-xl font-bold tracking-tight">Connected accounts</h2>
        <p className="text-content-secondary">
          Pull your Instagram posts in as portfolio pieces — you pick which ones.
        </p>
      </div>

      <Card padding="none" className="overflow-hidden">
        <CardPlacard meta={meta}>Instagram</CardPlacard>

        <div className="flex flex-col gap-4 p-5">
          {state.kind === "loading" ? (
            <div className="grid min-h-[6rem] place-items-center">
              <Spinner size={20} />
            </div>
          ) : state.kind === "comingSoon" ? (
            <p className="text-sm text-content-secondary">
              Instagram import requires Meta app approval — coming soon. It&apos;ll show up here
              the moment it&apos;s ready, no update needed.
            </p>
          ) : state.kind === "forbidden" ? (
            <p className="text-sm text-content-secondary">
              Finish setting up your artist profile to import from Instagram.
            </p>
          ) : state.kind === "error" ? (
            <p className="text-sm text-content-secondary">
              We couldn&apos;t check your Instagram connection right now. Refresh to try again.
            </p>
          ) : state.kind === "connected" ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-sm bg-surface-ember text-brand-on-ember">
                    <InstagramGlyph size={18} />
                  </span>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-content-primary">
                      Connected as @{state.username ?? "instagram"}
                    </span>
                    <span className="text-xs text-content-muted">
                      {state.lastSyncedAt
                        ? `Last synced ${formatRelativeTime(state.lastSyncedAt)}`
                        : "Not imported yet"}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => setPickerOpen(true)}>
                    Import posts
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setConfirmDisconnect(true)}
                  >
                    Disconnect
                  </Button>
                </div>
              </div>
              <p className="text-xs text-content-muted">{READ_ONLY_COPY}</p>
            </div>
          ) : state.kind === "tokenExpired" ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-content-secondary">
                Your Instagram connection expired. Reconnect to keep importing — your imported
                posts stay in your portfolio.
              </p>
              <div>
                <Button size="sm" onClick={() => void connect()} loading={startOAuth.isPending}>
                  <InstagramGlyph size={15} />
                  Reconnect to Instagram
                </Button>
              </div>
            </div>
          ) : (
            /* notConnected */
            <div className="flex flex-col gap-3">
              <p className="text-sm text-content-secondary">
                Connect your Instagram to pull your posts in as portfolio pieces.
              </p>
              <p className="text-xs text-content-muted">{REQUIREMENT_COPY}</p>
              <p className="text-xs text-content-muted">{READ_ONLY_COPY}</p>
              <div>
                <Button size="sm" onClick={() => void connect()} loading={startOAuth.isPending}>
                  <InstagramGlyph size={15} />
                  Connect Instagram
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {state.kind === "connected" && (
        <InstagramImportModal
          artistId={artist.id}
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          portfolioHref="/profile"
        />
      )}

      <Modal
        open={confirmDisconnect}
        onClose={() => setConfirmDisconnect(false)}
        title="Disconnect Instagram?"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setConfirmDisconnect(false)}>
              Keep connected
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => void doDisconnect()}
              loading={disconnect.isPending}
            >
              Disconnect
            </Button>
          </div>
        }
      >
        <p className="text-sm text-content-secondary">
          Your imported posts stay in your portfolio. You can reconnect anytime to import more.
        </p>
      </Modal>
    </div>
  );
}
