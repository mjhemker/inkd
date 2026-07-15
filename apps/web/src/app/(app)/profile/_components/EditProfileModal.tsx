"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Checkbox,
  FormField,
  Input,
  Modal,
  Select,
  TextArea,
  Toggle,
  useToast,
} from "@inkd/ui/web";
import type { ArtistProfile, ArtistClassificationEnum, Profile, UsState } from "@inkd/core";
import {
  useArtistStyleMutations,
  useArtistStyles,
  useUpdateArtistProfile,
  useUpdateProfile,
} from "@inkd/core";
import { ImageUploadField } from "./ImageUploadField";
import { StyleChipPicker } from "./StyleChipPicker";

const CLASSIFICATIONS: { value: ArtistClassificationEnum; label: string }[] = [
  { value: "independent", label: "Independent" },
  { value: "shop_owner", label: "Shop owner" },
  { value: "shop_resident", label: "Shop resident" },
  { value: "private_suite", label: "Private suite" },
];

const STATES: { value: UsState; label: string }[] = [
  { value: "MD", label: "Maryland" },
  { value: "PA", label: "Pennsylvania" },
];

export function EditProfileModal({
  open,
  onClose,
  profile,
  artist,
}: {
  open: boolean;
  onClose: () => void;
  profile: Profile;
  artist: ArtistProfile | null;
}) {
  const { toast } = useToast();
  const updateProfile = useUpdateProfile(profile.id);
  const updateArtist = useUpdateArtistProfile(artist?.id);
  const { data: taggedStyles } = useArtistStyles(artist?.id);
  const styleMutations = useArtistStyleMutations(artist?.id);

  const [displayName, setDisplayName] = useState(profile.display_name ?? "");
  const [handle, setHandle] = useState(profile.handle ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [city, setCity] = useState(profile.city ?? "");
  const [state, setState] = useState<string>(profile.state ?? "");
  const [isPublic, setIsPublic] = useState(profile.is_public);

  const [tagline, setTagline] = useState(artist?.tagline ?? "");
  const [artistBio, setArtistBio] = useState(artist?.bio ?? "");
  const [classification, setClassification] = useState<string>(
    artist?.classification ?? "independent",
  );
  const [flyOut, setFlyOut] = useState(artist?.travel_fly_out ?? false);
  const [houseCalls, setHouseCalls] = useState(artist?.travel_house_calls ?? false);
  const [atHome, setAtHome] = useState(artist?.travel_at_home ?? false);
  const [acceptsNew, setAcceptsNew] = useState(artist?.accepts_new_clients ?? true);
  const [yearsExperience, setYearsExperience] = useState(
    artist?.years_experience != null ? String(artist.years_experience) : "",
  );
  const [instagramHandle, setInstagramHandle] = useState(artist?.instagram_handle ?? "");
  const [isPublished, setIsPublished] = useState(artist?.is_published ?? false);
  const [selectedStyleIds, setSelectedStyleIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setDisplayName(profile.display_name ?? "");
    setHandle(profile.handle ?? "");
    setAvatarUrl(profile.avatar_url ?? "");
    setBio(profile.bio ?? "");
    setCity(profile.city ?? "");
    setState(profile.state ?? "");
    setIsPublic(profile.is_public);
    setTagline(artist?.tagline ?? "");
    setArtistBio(artist?.bio ?? "");
    setClassification(artist?.classification ?? "independent");
    setFlyOut(artist?.travel_fly_out ?? false);
    setHouseCalls(artist?.travel_house_calls ?? false);
    setAtHome(artist?.travel_at_home ?? false);
    setAcceptsNew(artist?.accepts_new_clients ?? true);
    setYearsExperience(artist?.years_experience != null ? String(artist.years_experience) : "");
    setInstagramHandle(artist?.instagram_handle ?? "");
    setIsPublished(artist?.is_published ?? false);
  }, [open, profile, artist]);

  useEffect(() => {
    setSelectedStyleIds((taggedStyles ?? []).map((s) => s.id));
  }, [taggedStyles]);

  const saving =
    updateProfile.isPending ||
    updateArtist.isPending ||
    styleMutations.add.isPending ||
    styleMutations.remove.isPending;

  async function handleToggleStyle(styleId: string) {
    const isSelected = selectedStyleIds.includes(styleId);
    setSelectedStyleIds((prev) =>
      isSelected ? prev.filter((id) => id !== styleId) : [...prev, styleId],
    );
    try {
      if (isSelected) {
        await styleMutations.remove.mutateAsync(styleId);
      } else {
        await styleMutations.add.mutateAsync(styleId);
      }
    } catch {
      // Revert optimistic toggle on failure.
      setSelectedStyleIds((prev) =>
        isSelected ? [...prev, styleId] : prev.filter((id) => id !== styleId),
      );
      toast({ title: "Couldn't update styles", variant: "danger" });
    }
  }

  async function handleSave() {
    try {
      // Publishing a public artist profile requires the underlying `profiles`
      // row to be readable under RLS (profiles_select checks is_public OR
      // self) — so force it on together with is_published, otherwise the
      // public /a/[handle] page would 404 for anonymous visitors.
      const effectivePublic = isPublic || isPublished;
      await updateProfile.mutateAsync({
        display_name: displayName.trim(),
        handle: handle.trim(),
        avatar_url: avatarUrl || null,
        bio: bio.trim() || null,
        city: city.trim() || null,
        state: (state || null) as UsState | null,
        is_public: effectivePublic,
      });
      if (artist) {
        await updateArtist.mutateAsync({
          tagline: tagline.trim() || null,
          bio: artistBio.trim() || null,
          classification: classification as ArtistClassificationEnum,
          travel_fly_out: flyOut,
          travel_house_calls: houseCalls,
          travel_at_home: atHome,
          accepts_new_clients: acceptsNew,
          years_experience: yearsExperience ? Number(yearsExperience) : null,
          instagram_handle: instagramHandle.trim() || null,
          is_published: isPublished,
        });
      }
      toast({ title: "Profile updated", variant: "success" });
      onClose();
    } catch (err) {
      toast({
        title: "Couldn't save profile",
        description: err instanceof Error ? err.message : undefined,
        variant: "danger",
      });
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={artist ? "Edit your profile" : "Edit profile"}
      description={
        artist
          ? "This is what clients see on your public artist page."
          : "Your name, handle, and a few personal details."
      }
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={saving}>
            Save changes
          </Button>
        </>
      }
    >
      <div className="flex max-h-[65vh] flex-col gap-6 overflow-y-auto pr-1">
        <div className="flex items-start gap-4">
          <ImageUploadField
            userId={profile.id}
            folder="avatars"
            value={avatarUrl}
            onChange={setAvatarUrl}
            label="Avatar"
            className="w-24 shrink-0"
          />
          <div className="grid flex-1 grid-cols-2 gap-3">
            <FormField label="Display name" required>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </FormField>
            <FormField label="Handle" required description="getinkd.co/a/handle">
              <Input
                value={handle}
                onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ""))}
                leadingIcon={<span className="text-content-muted">@</span>}
              />
            </FormField>
            <FormField label="City">
              <Input value={city} onChange={(e) => setCity(e.target.value)} />
            </FormField>
            <FormField label="State">
              <Select
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="Select state"
                options={STATES}
              />
            </FormField>
          </div>
        </div>

        {!artist && (
          <FormField label="Bio">
            <TextArea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} />
          </FormField>
        )}

        <Checkbox
          checked={isPublic}
          onCheckedChange={setIsPublic}
          label="Make my profile discoverable to other members"
        />

        {artist && (
          <>
            <div className="h-px bg-border-subtle" />
            <FormField label="Tagline" description="One line under your name on your public page.">
              <Input
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                maxLength={160}
                placeholder="Fine line & botanical work, Baltimore"
              />
            </FormField>
            <FormField label="Artist bio">
              <TextArea
                value={artistBio}
                onChange={(e) => setArtistBio(e.target.value)}
                rows={4}
                placeholder="Tell clients about your background, approach, and what to expect at a session."
              />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Classification">
                <Select
                  value={classification}
                  onChange={(e) => setClassification(e.target.value)}
                  options={CLASSIFICATIONS}
                />
              </FormField>
              <FormField label="Years of experience">
                <Input
                  type="number"
                  min={0}
                  max={80}
                  value={yearsExperience}
                  onChange={(e) => setYearsExperience(e.target.value)}
                />
              </FormField>
              <FormField label="Instagram handle" className="col-span-2">
                <Input
                  value={instagramHandle}
                  onChange={(e) => setInstagramHandle(e.target.value)}
                  leadingIcon={<span className="text-content-muted">@</span>}
                />
              </FormField>
            </div>
            <FormField label="Travel">
              <div className="flex flex-wrap gap-4 pt-1">
                <Toggle checked={flyOut} onCheckedChange={setFlyOut} label="Fly-out" />
                <Toggle checked={houseCalls} onCheckedChange={setHouseCalls} label="House calls" />
                <Toggle checked={atHome} onCheckedChange={setAtHome} label="At-home" />
              </div>
            </FormField>
            <Toggle
              checked={acceptsNew}
              onCheckedChange={setAcceptsNew}
              label="Accepting new clients"
            />
            <FormField label="Styles">
              <StyleChipPicker selected={selectedStyleIds} onToggle={handleToggleStyle} />
            </FormField>
            <div className="rounded-xl border border-border-subtle bg-surface-overlay p-4">
              <Toggle
                checked={isPublished}
                onCheckedChange={setIsPublished}
                label="Publish my public profile"
              />
              <p className="mt-1.5 pl-[52px] text-xs text-content-muted">
                Off keeps getinkd.co/a/{handle || "your-handle"} private while you build it out.
              </p>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
