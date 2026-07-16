import { forwardRef, useImperativeHandle, useState } from "react";
import { Pressable, Text, View } from "react-native";
import {
  Badge,
  Button,
  Card,
  FormField,
  Icon,
  Input,
  RadioGroup,
  Toggle,
  useToast,
} from "@inkd/ui/native";
import type {
  ArtistClassificationEnum,
  ArtistProfile,
  StudioLocation,
  UsState,
} from "@inkd/core";
import {
  useStudioLocations,
  useStudioLocationMutations,
  useUpdateArtistProfile,
} from "@inkd/core/hooks";

import { CLASSIFICATIONS, STATE_OPTIONS } from "@inkd/core";
import { PickerSelect } from "./pickers";
import type { EditorHandle } from "./types";
import { useTheme } from "@/providers/theme";

interface LocationDraft {
  name: string;
  address_line1: string;
  city: string;
  stateChoice: string; // "MD" | "PA" | "OTHER"
}

const emptyDraft: LocationDraft = {
  name: "",
  address_line1: "",
  city: "",
  stateChoice: "MD",
};

function stateFromChoice(choice: string): UsState | null {
  return choice === "MD" || choice === "PA" ? choice : null;
}

export interface LocationsEditorProps {
  artist: ArtistProfile;
  variant?: "onboarding" | "settings";
}

export const LocationsEditor = forwardRef<EditorHandle, LocationsEditorProps>(
  function LocationsEditor({ artist, variant = "onboarding" }, ref) {
    const { colors } = useTheme();
    const { toast } = useToast();
    const { data: locations } = useStudioLocations(artist.id);
    const { create, remove } = useStudioLocationMutations(artist.id);
    const updateArtist = useUpdateArtistProfile(artist.id);

    const [classification, setClassification] = useState<ArtistClassificationEnum>(
      artist.classification ?? "independent",
    );
    const [flyOut, setFlyOut] = useState(artist.travel_fly_out);
    const [houseCalls, setHouseCalls] = useState(artist.travel_house_calls);
    const [atHome, setAtHome] = useState(artist.travel_at_home);

    const [draft, setDraft] = useState<LocationDraft>(emptyDraft);
    const [adding, setAdding] = useState(false);

    async function addLocation() {
      if (!draft.name.trim() && !draft.city.trim()) {
        toast({ title: "Add a label or city", variant: "danger" });
        return;
      }
      try {
        await create.mutateAsync({
          name: draft.name.trim() || null,
          address_line1: draft.address_line1.trim() || null,
          city: draft.city.trim() || null,
          state: stateFromChoice(draft.stateChoice),
          is_primary: (locations?.length ?? 0) === 0,
        });
        setDraft(emptyDraft);
        setAdding(false);
        toast({ title: "Location added", variant: "success" });
      } catch (err) {
        toast({
          title: "Couldn't add location",
          description: err instanceof Error ? err.message : "Try again.",
          variant: "danger",
        });
      }
    }

    async function save(): Promise<boolean> {
      try {
        await updateArtist.mutateAsync({
          classification,
          travel_fly_out: flyOut,
          travel_house_calls: houseCalls,
          travel_at_home: atHome,
        });
        return true;
      } catch (err) {
        toast({
          title: "Couldn't save",
          description: err instanceof Error ? err.message : "Try again.",
          variant: "danger",
        });
        return false;
      }
    }

    useImperativeHandle(ref, () => ({ save }));

    return (
      <View className="gap-8">
        {/* Classification */}
        <View className="gap-3">
          <Text className="text-sm font-sans-medium text-content-primary">
            How do you work?
          </Text>
          <RadioGroup
            value={classification}
            onValueChange={(v) => setClassification(v as ArtistClassificationEnum)}
            options={CLASSIFICATIONS.map((c) => ({
              label: c.label,
              value: c.value,
              description: c.description,
            }))}
          />
        </View>

        {/* Locations list */}
        <View className="gap-3">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-sans-medium text-content-primary">
              Studio locations
            </Text>
            {!adding && (
              <Button
                size="sm"
                variant="outline"
                leadingIcon={<Icon name="plus" size={15} color={colors.text.primary} />}
                onPress={() => setAdding(true)}
              >
                Add location
              </Button>
            )}
          </View>

          {locations && locations.length > 0 ? (
            <View className="gap-2.5">
              {locations.map((loc: StudioLocation) => (
                <Card key={loc.id} padding="sm" className="flex-row items-center gap-3">
                  <View className="h-9 w-9 items-center justify-center rounded-lg bg-surface-overlay">
                    <Icon name="map-pin" size={16} color={colors.text.accent} />
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2">
                      <Text className="text-sm font-sans-medium text-content-primary">
                        {loc.name ?? loc.city ?? "Studio"}
                      </Text>
                      {loc.is_primary && (
                        <Badge variant="brand" size="sm">
                          Primary
                        </Badge>
                      )}
                    </View>
                    <Text className="text-xs text-content-muted">
                      {[loc.address_line1, loc.city, loc.state].filter(Boolean).join(", ") ||
                        "No address yet"}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => remove.mutate(loc.id)}
                    accessibilityRole="button"
                    accessibilityLabel="Remove location"
                    className="h-8 w-8 items-center justify-center rounded-lg"
                  >
                    <Icon name="x" size={16} color={colors.text.muted} />
                  </Pressable>
                </Card>
              ))}
            </View>
          ) : (
            !adding && (
              <Text className="rounded-xl border border-dashed border-border-subtle px-4 py-6 text-center text-sm text-content-muted">
                No locations yet. Add where you tattoo, or lean on travel options below.
              </Text>
            )
          )}

          {adding && (
            <Card padding="md" className="gap-4">
              <FormField label="Label">
                <Input
                  placeholder="Ravenite Tattoo — Fells Point"
                  value={draft.name}
                  onChangeText={(v) => setDraft({ ...draft, name: v })}
                />
              </FormField>
              <FormField label="Street address">
                <Input
                  placeholder="1700 Thames St"
                  value={draft.address_line1}
                  onChangeText={(v) => setDraft({ ...draft, address_line1: v })}
                />
              </FormField>
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <FormField label="City">
                    <Input
                      placeholder="Baltimore"
                      value={draft.city}
                      onChangeText={(v) => setDraft({ ...draft, city: v })}
                    />
                  </FormField>
                </View>
                <View className="flex-1">
                  <FormField label="State">
                    <PickerSelect
                      title="State"
                      options={STATE_OPTIONS}
                      value={draft.stateChoice}
                      onValueChange={(v) => setDraft({ ...draft, stateChoice: v })}
                    />
                  </FormField>
                </View>
              </View>
              <View className="flex-row justify-end gap-2">
                <Button
                  variant="ghost"
                  onPress={() => {
                    setAdding(false);
                    setDraft(emptyDraft);
                  }}
                >
                  Cancel
                </Button>
                <Button onPress={() => void addLocation()} loading={create.isPending}>
                  Add location
                </Button>
              </View>
            </Card>
          )}
        </View>

        {/* Travel */}
        <View className="gap-3">
          <Text className="text-sm font-sans-medium text-content-primary">Travel options</Text>
          <View className="gap-3 rounded-xl border border-border-subtle bg-surface-raised/40 px-4 py-3.5">
            <Toggle checked={flyOut} onCheckedChange={setFlyOut} label="Fly-outs — I travel for guest spots" />
            <Toggle
              checked={houseCalls}
              onCheckedChange={setHouseCalls}
              label="House calls — I come to the client"
            />
            <Toggle checked={atHome} onCheckedChange={setAtHome} label="At-home — I tattoo from my own space" />
          </View>
        </View>

        {variant === "settings" && (
          <View className="items-end">
            <Button onPress={() => void save()} loading={updateArtist.isPending}>
              Save changes
            </Button>
          </View>
        )}
      </View>
    );
  },
);
