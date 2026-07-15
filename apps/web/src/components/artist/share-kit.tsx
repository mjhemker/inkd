"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Card, Icon, useToast } from "@inkd/ui/web";
import type { Profile } from "@inkd/core";

import { downloadCanvasAsPng, renderBookingPlacard } from "@/lib/qr-placard";

export interface ShareKitProps {
  profile: Profile;
}

function blurbsFor(handle: string): string[] {
  return [
    `Books open — request via INKD: getinkd.co/a/${handle}`,
    `New slots up soon. Book direct, no DMs needed: getinkd.co/a/${handle}`,
    `Link in bio ↑ or go straight to getinkd.co/a/${handle} to request a session.`,
  ];
}

/**
 * "Your booking link" — the settings share section (SPEC §0: portfolio import
 * + booking deeplinks turn Instagram traffic into INKD bookings). Fully
 * working today, no keys required: a copyable link, a client-side QR/placard
 * PNG (via the `qrcode` package — no network, no API key), and copy-ready
 * link-in-bio blurbs.
 */
export function ShareKit({ profile }: ShareKitProps) {
  const { toast } = useToast();
  const handle = profile.handle ?? "";
  const bookingUrl = `https://getinkd.co/a/${handle}`;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedBlurb, setCopiedBlurb] = useState<number | null>(null);

  useEffect(() => {
    if (!handle) return;
    let cancelled = false;
    void (async () => {
      try {
        const canvas = await renderBookingPlacard({ url: bookingUrl, handle });
        if (cancelled) return;
        canvasRef.current = canvas;
        setQrDataUrl(canvas.toDataURL("image/png"));
      } catch {
        // Canvas unsupported in this environment — copy/blurb affordances still work.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [handle, bookingUrl]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(bookingUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 1600);
    } catch {
      toast({ title: "Couldn't copy", description: "Copy the link manually.", variant: "danger" });
    }
  }

  async function copyBlurb(text: string, idx: number) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedBlurb(idx);
      setTimeout(() => setCopiedBlurb((cur) => (cur === idx ? null : cur)), 1600);
    } catch {
      toast({ title: "Couldn't copy", description: "Copy the text manually.", variant: "danger" });
    }
  }

  async function downloadPlacard() {
    if (!canvasRef.current) return;
    setDownloading(true);
    try {
      await downloadCanvasAsPng(canvasRef.current, `inkd-${handle}-booking-qr.png`);
    } catch (err) {
      toast({
        title: "Couldn't generate the PNG",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "danger",
      });
    } finally {
      setDownloading(false);
    }
  }

  if (!handle) {
    return (
      <Card padding="lg">
        <p className="text-content-secondary">
          Set your handle in the Profile tab to get a booking link.
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h2 className="font-display text-xl font-bold tracking-tight">Your booking link</h2>
        <p className="text-content-secondary">
          Funnel Instagram traffic straight into INKD bookings.
        </p>
      </div>

      <Card padding="lg" className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <div className="flex flex-1 flex-col gap-5">
          <div className="flex items-center gap-2 rounded-lg border border-border-subtle bg-surface-overlay px-3 py-2.5">
            <span className="flex-1 truncate font-mono text-sm text-content-primary">
              getinkd.co/a/{handle}
            </span>
            <Button size="sm" variant="outline" onClick={() => void copyLink()}>
              {copiedLink && <Icon name="check" size={14} />}
              {copiedLink ? "Copied" : "Copy"}
            </Button>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-content-muted">
              Link-in-bio blurbs
            </span>
            {blurbsFor(handle).map((text, idx) => (
              <div
                key={text}
                className="flex items-start justify-between gap-3 rounded-lg bg-surface-overlay px-3 py-2.5"
              >
                <p className="text-sm text-content-secondary">{text}</p>
                <Button size="sm" variant="ghost" onClick={() => void copyBlurb(text, idx)}>
                  {copiedBlurb === idx ? "Copied" : "Copy"}
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-center gap-3">
          <div className="grid h-44 w-44 place-items-center overflow-hidden rounded-sm border border-border-subtle bg-surface-overlay">
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrDataUrl} alt="QR code linking to your INKD booking page" className="h-full w-full" />
            ) : (
              <Icon name="image" size={22} className="text-content-muted" />
            )}
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void downloadPlacard()}
            loading={downloading}
            disabled={!qrDataUrl}
          >
            Download PNG
          </Button>
        </div>
      </Card>
    </div>
  );
}
