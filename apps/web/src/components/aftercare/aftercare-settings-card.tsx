"use client";

/** Artist toggle for the aftercare healing timeline. Always-on by default;
 * flipping it off stops new completed sessions from scheduling check-ins. */
import {
  useUpdateArtistProfile,
  type ArtistProfile,
} from "@inkd/core";
import { Card, Icon, Spinner, Toggle } from "@inkd/ui/web";

export function AftercareSettingsCard({ artist }: { artist: ArtistProfile }) {
  const update = useUpdateArtistProfile(artist.id);
  const enabled = artist.aftercare_enabled ?? true;

  return (
    <Card padding="lg" className="flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-9 w-9 place-items-center rounded-sm bg-surface-ember text-brand-on-ember">
          <Icon name="sparkles" size={17} />
        </span>
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold">Aftercare check-ins</h3>
          <p className="max-w-md text-sm text-content-secondary">
            Automatically check in with clients at 3 days, 1 week, and 3 weeks after a completed
            session — how it&apos;s healing, an optional photo, and (with their consent) a healed
            photo for your portfolio.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {update.isPending && <Spinner size={16} />}
        <Toggle
          checked={enabled}
          onCheckedChange={(v) => update.mutate({ aftercare_enabled: v })}
          disabled={update.isPending}
        />
      </div>
    </Card>
  );
}
