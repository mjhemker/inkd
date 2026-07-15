import { useState } from "react";
import { Share, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Button, Card, useToast } from "@inkd/ui/native";
import type { Profile } from "@inkd/core";

import { QrMatrix } from "./qr-matrix";

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
 * "Your booking link" — the mobile settings share section (SPEC §0). Fully
 * working today, no keys required: an on-screen QR (see qr-matrix.tsx — pure
 * JS, no native module), a copy-to-clipboard link, a native share-sheet
 * trigger, and copy-ready link-in-bio blurbs.
 */
export function ShareKit({ profile }: ShareKitProps) {
  const { toast } = useToast();
  const handle = profile.handle ?? "";
  const bookingUrl = `https://getinkd.co/a/${handle}`;
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedBlurb, setCopiedBlurb] = useState<number | null>(null);

  async function copyLink() {
    try {
      await Clipboard.setStringAsync(bookingUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 1600);
    } catch {
      toast({ title: "Couldn't copy", variant: "danger" });
    }
  }

  async function copyBlurb(text: string, idx: number) {
    try {
      await Clipboard.setStringAsync(text);
      setCopiedBlurb(idx);
      setTimeout(() => setCopiedBlurb((cur) => (cur === idx ? null : cur)), 1600);
    } catch {
      toast({ title: "Couldn't copy", variant: "danger" });
    }
  }

  async function shareLink() {
    try {
      await Share.share({ message: bookingUrl });
    } catch {
      toast({ title: "Couldn't open the share sheet", variant: "danger" });
    }
  }

  if (!handle) {
    return (
      <Card padding="lg">
        <Text className="text-content-secondary">
          Set your handle in the Profile tab to get a booking link.
        </Text>
      </Card>
    );
  }

  return (
    <View className="gap-6">
      <View className="gap-1.5">
        <Text className="font-display text-xl text-content-primary">
          Your booking link
        </Text>
        <Text className="text-content-secondary">
          Funnel Instagram traffic straight into INKD bookings.
        </Text>
      </View>

      <Card padding="lg" className="items-center gap-5">
        <View className="border border-border-subtle bg-surface-overlay p-3">
          <QrMatrix value={bookingUrl} size={168} />
        </View>

        <View className="w-full flex-row items-center gap-2 rounded-lg border border-border-subtle bg-surface-overlay px-3 py-2.5">
          <Text className="flex-1 font-mono text-sm text-content-primary" numberOfLines={1}>
            getinkd.co/a/{handle}
          </Text>
          <Button size="sm" variant="outline" onPress={() => void copyLink()}>
            {copiedLink ? "Copied" : "Copy"}
          </Button>
        </View>

        <Button
          size="sm"
          variant="outline"
          onPress={() => void shareLink()}
          className="w-full"
        >
          Share link
        </Button>
      </Card>

      <View className="gap-2">
        <Text className="text-xs font-sans-medium uppercase tracking-wide text-content-muted">
          Link-in-bio blurbs
        </Text>
        {blurbsFor(handle).map((text, idx) => (
          <View
            key={text}
            className="flex-row items-start justify-between gap-3 rounded-lg bg-surface-overlay px-3 py-2.5"
          >
            <Text className="flex-1 text-sm text-content-secondary">{text}</Text>
            <Button size="sm" variant="ghost" onPress={() => void copyBlurb(text, idx)}>
              {copiedBlurb === idx ? "Copied" : "Copy"}
            </Button>
          </View>
        ))}
      </View>
    </View>
  );
}
