import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import {
  Button,
  Checkbox,
  Chip,
  FormField,
  Input,
  Sheet,
  TextArea,
  Toggle,
  useToast,
} from "@inkd/ui/native";
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

export function EditProfileSheet({
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
  const [state, setState] = useState<UsState | "">(profile.state ?? "");
  const [isPublic, setIsPublic] = useState(profile.is_public);

  const [tagline, setTagline] = useState(artist?.tagline ?? "");
  const [artistBio, setArtistBio] = useState(artist?.bio ?? "");
  const [classification, setClassification] = useState<ArtistClassificationEnum>(
    artist?.classification ?? "independent",
  );
  const [flyOut, setFlyOut] = useState(artist?.travel_fly_out ?? false);
  const [houseCalls, setHouseCalls] = useState(artist?.travel_house_calls ?? false);
  const [atHome, setAtHome] = useState(artist?.travel_at_home ?? false);
  const [acceptsNew, setAcceptsNew] = useState(artist?.accepts_new_clients ?? true);
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
    setIsPublished(artist?.is_published ?? false);
  }, [open, profile, artist]);

  useEffect(() => {
    setSelectedStyleIds((taggedStyles ?? []).map((s) => s.id));
  }, [taggedStyles]);

  const saving = updateProfile.isPending || updateArtist.isPending;

  async function handleToggleStyle(styleId: string) {
    const isSelected = selectedStyleIds.includes(styleId);
    setSelectedStyleIds((prev) =>
      isSelected ? prev.filter((id) => id !== styleId) : [...prev, styleId],
    );
    try {
      if (isSelected) await styleMutations.remove.mutateAsync(styleId);
      else await styleMutations.add.mutateAsync(styleId);
    } catch {
      toast({ title: "Couldn't update styles", variant: "danger" });
    }
  }

  async function handleSave() {
    try {
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
          classification,
          travel_fly_out: flyOut,
          travel_house_calls: houseCalls,
          travel_at_home: atHome,
          accepts_new_clients: acceptsNew,
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
    <Sheet open={open} onClose={onClose} title={artist ? "Edit your profile" : "Edit profile"}>
      <ScrollView className="max-h-[70vh]" showsVerticalScrollIndicator={false}>
        <View className="gap-4 pb-4">
          <ImageUploadField userId={profile.id} folder="avatars" value={avatarUrl} onChange={setAvatarUrl} label="Avatar" className="w-24" />
          <FormField label="Display name" required>
            <Input value={displayName} onChangeText={setDisplayName} />
          </FormField>
          <FormField label="Handle" required description="getinkd.co/a/handle">
            <Input
              value={handle}
              onChangeText={(v) => setHandle(v.toLowerCase().replace(/[^a-z0-9._-]/g, ""))}
              autoCapitalize="none"
            />
          </FormField>
          <View className="flex-row gap-3">
            <FormField label="City" className="flex-1">
              <Input value={city} onChangeText={setCity} />
            </FormField>
            <FormField label="State" className="flex-1">
              <View className="flex-row gap-2">
                {STATES.map((s) => (
                  <Chip key={s.value} selected={state === s.value} onPress={() => setState(s.value)}>
                    {s.value}
                  </Chip>
                ))}
              </View>
            </FormField>
          </View>

          {!artist && (
            <FormField label="Bio">
              <TextArea value={bio} onChangeText={setBio} numberOfLines={3} />
            </FormField>
          )}

          <Checkbox checked={isPublic} onCheckedChange={setIsPublic} label="Discoverable to other members" />

          {artist && (
            <>
              <View className="h-px bg-border-subtle" />
              <FormField label="Tagline">
                <Input value={tagline} onChangeText={setTagline} placeholder="Fine line & botanical work" />
              </FormField>
              <FormField label="Artist bio">
                <TextArea value={artistBio} onChangeText={setArtistBio} numberOfLines={4} />
              </FormField>
              <FormField label="Classification">
                <View className="flex-row flex-wrap gap-2">
                  {CLASSIFICATIONS.map((c) => (
                    <Chip key={c.value} selected={classification === c.value} onPress={() => setClassification(c.value)}>
                      {c.label}
                    </Chip>
                  ))}
                </View>
              </FormField>
              <FormField label="Travel">
                <View className="flex-row flex-wrap gap-4 pt-1">
                  <Toggle checked={flyOut} onCheckedChange={setFlyOut} label="Fly-out" />
                  <Toggle checked={houseCalls} onCheckedChange={setHouseCalls} label="House calls" />
                  <Toggle checked={atHome} onCheckedChange={setAtHome} label="At-home" />
                </View>
              </FormField>
              <Toggle checked={acceptsNew} onCheckedChange={setAcceptsNew} label="Accepting new clients" />
              <FormField label="Styles">
                <StyleChipPicker selected={selectedStyleIds} onToggle={handleToggleStyle} />
              </FormField>
              <View className="gap-1.5 rounded-xl border border-border-subtle bg-surface-overlay p-4">
                <Toggle checked={isPublished} onCheckedChange={setIsPublished} label="Publish my public profile" />
                <Text className="text-xs text-content-muted">
                  Off keeps your public page private while you build it out.
                </Text>
              </View>
            </>
          )}

          <View className="flex-row gap-3 pt-2">
            <Button variant="secondary" onPress={onClose} className="flex-1">
              Cancel
            </Button>
            <Button onPress={handleSave} loading={saving} className="flex-1">
              Save
            </Button>
          </View>
        </View>
      </ScrollView>
    </Sheet>
  );
}
