"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import {
  Badge,
  Button,
  Card,
  FormField,
  Icon,
  Input,
  RadioGroup,
  Select,
  Toggle,
  useToast,
} from "@inkd/ui/web";
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

import { CLASSIFICATIONS, STATE_OPTIONS } from "./constants";
import type { EditorHandle } from "./types";

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
      <div className="flex flex-col gap-8">
        {/* Classification */}
        <div className="flex flex-col gap-3">
          <span className="text-sm font-medium text-content-primary">
            How do you work?
          </span>
          <RadioGroup
            value={classification}
            onValueChange={(v) => setClassification(v as ArtistClassificationEnum)}
            options={CLASSIFICATIONS.map((c) => ({
              label: c.label,
              value: c.value,
              description: c.description,
            }))}
          />
        </div>

        {/* Locations list */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-content-primary">
              Studio locations
            </span>
            {!adding && (
              <Button
                size="sm"
                variant="outline"
                leadingIcon={<Icon name="plus" size={15} />}
                onClick={() => setAdding(true)}
              >
                Add location
              </Button>
            )}
          </div>

          {locations && locations.length > 0 ? (
            <div className="flex flex-col gap-2.5">
              {locations.map((loc: StudioLocation) => (
                <Card key={loc.id} padding="sm" className="flex items-center gap-3">
                  <div className="flex flex-1 items-center gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-surface-overlay text-content-accent">
                      <Icon name="map-pin" size={16} />
                    </span>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-content-primary">
                        {loc.name ?? loc.city ?? "Studio"}
                        {loc.is_primary && (
                          <Badge variant="brand" size="sm" className="ml-2">
                            Primary
                          </Badge>
                        )}
                      </span>
                      <span className="text-xs text-content-muted">
                        {[loc.address_line1, loc.city, loc.state]
                          .filter(Boolean)
                          .join(", ") || "No address yet"}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove.mutate(loc.id)}
                    className="grid h-8 w-8 place-items-center rounded-lg text-content-muted outline-none transition-colors hover:bg-surface-overlay hover:text-danger-500 focus-visible:ring-2 focus-visible:ring-brand"
                    aria-label="Remove location"
                  >
                    <Icon name="x" size={16} />
                  </button>
                </Card>
              ))}
            </div>
          ) : (
            !adding && (
              <p className="rounded-xl border border-dashed border-border-subtle px-4 py-6 text-center text-sm text-content-muted">
                No locations yet. Add where you tattoo, or lean on travel options
                below.
              </p>
            )
          )}

          {adding && (
            <Card padding="md" className="flex flex-col gap-4">
              <FormField label="Label" htmlFor="loc-name">
                <Input
                  id="loc-name"
                  placeholder="Ravenite Tattoo — Fells Point"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </FormField>
              <FormField label="Street address" htmlFor="loc-addr">
                <Input
                  id="loc-addr"
                  placeholder="1700 Thames St"
                  value={draft.address_line1}
                  onChange={(e) =>
                    setDraft({ ...draft, address_line1: e.target.value })
                  }
                />
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="City" htmlFor="loc-city">
                  <Input
                    id="loc-city"
                    placeholder="Baltimore"
                    value={draft.city}
                    onChange={(e) => setDraft({ ...draft, city: e.target.value })}
                  />
                </FormField>
                <FormField label="State" htmlFor="loc-state">
                  <Select
                    id="loc-state"
                    options={STATE_OPTIONS}
                    value={draft.stateChoice}
                    onChange={(e) =>
                      setDraft({ ...draft, stateChoice: e.target.value })
                    }
                  />
                </FormField>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setAdding(false);
                    setDraft(emptyDraft);
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={() => void addLocation()} loading={create.isPending}>
                  Add location
                </Button>
              </div>
            </Card>
          )}
        </div>

        {/* Travel */}
        <div className="flex flex-col gap-3">
          <span className="text-sm font-medium text-content-primary">
            Travel options
          </span>
          <div className="flex flex-col gap-3 rounded-xl border border-border-subtle bg-surface-raised/40 px-4 py-3.5">
            <Toggle checked={flyOut} onCheckedChange={setFlyOut} label="Fly-outs — I travel for guest spots" />
            <Toggle
              checked={houseCalls}
              onCheckedChange={setHouseCalls}
              label="House calls — I come to the client"
            />
            <Toggle checked={atHome} onCheckedChange={setAtHome} label="At-home — I tattoo from my own space" />
          </div>
        </div>

        {variant === "settings" && (
          <div className="flex justify-end">
            <Button onClick={() => void save()} loading={updateArtist.isPending}>
              Save changes
            </Button>
          </div>
        )}
      </div>
    );
  },
);
