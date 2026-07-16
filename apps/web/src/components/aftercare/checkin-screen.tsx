"use client";

/**
 * Client-facing aftercare check-in. The client logs how their tattoo is healing
 * (a rating + optional note), can attach a private healed photo, and — only via
 * an explicit, default-OFF consent toggle — lets the artist share that photo on
 * their INKD portfolio. Submitting stamps the check-in `responded` and notifies
 * the artist (DB trigger).
 */
import { useMemo, useRef, useState } from "react";
import {
  useCurrentProfile,
  useAftercareCheckinContext,
  useRespondToAftercareCheckin,
  uploadAftercarePhoto,
  useInkdClient,
  aftercareKindLabel,
  firstName,
  deriveShareState,
  type AftercareCheckin,
} from "@inkd/core";
import { Button, Card, Eyebrow, Icon, Spinner, TextArea, Toggle, useToast } from "@inkd/ui/web";

const RATINGS = [
  { value: 1, label: "Rough" },
  { value: 2, label: "Sore" },
  { value: 3, label: "Okay" },
  { value: 4, label: "Good" },
  { value: 5, label: "Great" },
];

export function AftercareCheckinScreen({ checkinId }: { checkinId: string }) {
  const { toast } = useToast();
  const client = useInkdClient();
  const { data: profile } = useCurrentProfile();
  const ctxQ = useAftercareCheckinContext(checkinId);
  const ctx = ctxQ.data ?? null;
  const checkin = ctx?.checkin ?? null;

  const respond = useRespondToAftercareCheckin(checkin);

  const [rating, setRating] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const artistName = ctx?.artistDisplayName ?? "your artist";
  const artistFirst = firstName(ctx?.artistDisplayName);
  const tattoo = ctx?.tattooLabel ?? "your new ink";

  const alreadyResponded = checkin?.status === "responded";

  if (ctxQ.isLoading) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <Spinner size={26} />
      </div>
    );
  }
  if (!checkin) {
    return (
      <Card padding="lg">
        <p className="text-content-secondary">
          This healing check-in isn&apos;t available. It may have expired or you don&apos;t have access.
        </p>
      </Card>
    );
  }

  if (alreadyResponded) {
    return <RespondedSummary checkin={checkin} artistName={artistName} />;
  }

  async function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    setUploading(true);
    try {
      const path = await uploadAftercarePhoto(client, {
        clientId: profile.id,
        checkinId,
        file,
        filename: file.name,
        contentType: file.type,
      });
      setPhotoPath(path);
      setPhotoPreview(URL.createObjectURL(file));
    } catch (err) {
      toast({
        title: "Couldn't upload photo",
        description: err instanceof Error ? err.message : undefined,
        variant: "danger",
      });
    } finally {
      setUploading(false);
    }
  }

  function removePhoto() {
    setPhotoPath(null);
    setPhotoPreview(null);
    setConsent(false); // consent is meaningless without a photo
    if (fileRef.current) fileRef.current.value = "";
  }

  async function onSubmit() {
    if (rating == null) {
      toast({ title: "Pick how it's feeling first" });
      return;
    }
    try {
      await respond.mutateAsync({
        healing_rating: rating,
        note: note.trim() || null,
        photo_path: photoPath,
        consent_to_share: consent,
      });
      toast({ title: "Thanks — shared with your artist", variant: "success" });
    } catch (err) {
      toast({
        title: "Couldn't submit",
        description: err instanceof Error ? err.message : undefined,
        variant: "danger",
      });
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Eyebrow>Healing check-in · {aftercareKindLabel(checkin.kind)}</Eyebrow>
        <h1 className="font-display text-2xl font-extrabold tracking-tight">
          How&apos;s {tattoo} healing?
        </h1>
        <p className="text-content-secondary">
          A quick update helps {artistFirst} keep an eye on your healing.
        </p>
      </div>

      {/* Rating */}
      <Card padding="lg" className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-content-secondary">How&apos;s it feeling?</h2>
        <div className="grid grid-cols-5 gap-2">
          {RATINGS.map((r) => {
            const active = rating === r.value;
            return (
              <button
                key={r.value}
                type="button"
                onClick={() => setRating(r.value)}
                className={
                  "flex flex-col items-center gap-1 rounded-sm border px-2 py-3 text-xs transition-colors " +
                  (active
                    ? "border-border-accent bg-surface-ember text-brand-on-ember"
                    : "border-border-subtle bg-surface-raised text-content-secondary hover:border-border-accent")
                }
              >
                <span className="text-base font-bold">{r.value}</span>
                <span>{r.label}</span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Note */}
      <Card padding="lg" className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-content-secondary">
          Anything to add? <span className="font-normal">(optional)</span>
        </h2>
        <TextArea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="Peeling a little, no redness…"
          maxLength={2000}
        />
      </Card>

      {/* Photo + consent */}
      <Card padding="lg" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold text-content-secondary">Add a healed photo</h2>
          <p className="text-xs text-content-tertiary">
            Private by default — only you and {artistFirst} can see it unless you choose to share it below.
          </p>
        </div>

        {photoPreview ? (
          <div className="relative overflow-hidden rounded-sm border border-border-subtle">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoPreview} alt="Healed tattoo" className="max-h-72 w-full object-cover" />
            <button
              type="button"
              onClick={removePhoto}
              className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-surface-overlay/90 text-content-primary"
              aria-label="Remove photo"
            >
              <Icon name="x" size={16} />
            </button>
          </div>
        ) : (
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-sm border border-dashed border-border-subtle bg-surface-raised px-4 py-6 text-sm text-content-secondary hover:border-border-accent">
            {uploading ? <Spinner size={18} /> : <Icon name="image" size={18} />}
            <span>{uploading ? "Uploading…" : "Choose a photo"}</span>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onPickPhoto}
              disabled={uploading}
            />
          </label>
        )}

        <div
          className={
            "flex items-start justify-between gap-4 rounded-sm border px-4 py-3 " +
            (photoPath ? "border-border-subtle" : "border-border-subtle opacity-60")
          }
        >
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">
              Let {artistName} share this healed photo on their INKD portfolio
            </span>
            <span className="text-xs text-content-tertiary">
              Off by default. You can add a photo without sharing it.
            </span>
          </div>
          <Toggle
            checked={consent}
            onCheckedChange={setConsent}
            disabled={!photoPath}
          />
        </div>
      </Card>

      <Button onClick={onSubmit} disabled={respond.isPending || uploading} size="lg">
        {respond.isPending ? <Spinner size={18} /> : <Icon name="check" size={18} />}
        Share my update
      </Button>
    </div>
  );
}

function RespondedSummary({
  checkin,
  artistName,
}: {
  checkin: AftercareCheckin;
  artistName: string;
}) {
  const shareState = useMemo(() => deriveShareState(checkin), [checkin]);
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <Card padding="lg" className="flex flex-col items-start gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-surface-ember text-brand-on-ember">
          <Icon name="check" size={20} />
        </span>
        <h1 className="font-display text-xl font-bold tracking-tight">Update shared</h1>
        <p className="text-content-secondary">
          Thanks — {artistName} has your healing update
          {checkin.healing_rating ? ` (feeling: ${checkin.healing_rating}/5)` : ""}.
        </p>
        {checkin.note && (
          <p className="rounded-sm bg-surface-raised px-3 py-2 text-sm text-content-secondary">
            “{checkin.note}”
          </p>
        )}
        {checkin.photo_path && (
          <p className="text-xs text-content-tertiary">
            {shareState === "shared"
              ? "Your healed photo is featured on their portfolio."
              : checkin.consent_to_share
                ? "You shared a healed photo — thanks for letting them feature your healing!"
                : "You added a private healed photo (not shared)."}
          </p>
        )}
      </Card>
    </div>
  );
}
