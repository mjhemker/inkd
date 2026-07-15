import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Pressable, Text, View } from "react-native";
import { Button, Icon, RadioGroup, Toggle, useToast } from "@inkd/ui/native";
import type { ArtistProfile, AvailabilityRule, BookingWindow } from "@inkd/core";
import { BOOKING_WINDOWS, WEEKDAYS } from "@inkd/core";
import {
  useAvailabilityRules,
  useAvailabilityBlocks,
  useAvailabilityMutations,
  useBookingPolicy,
} from "@inkd/core/hooks";

import { PickerDateField, PickerTimeField } from "./pickers";
import type { EditorHandle } from "./types";

interface DayState {
  open: boolean;
  start: string;
  end: string;
}

function defaultDay(weekday: number): DayState {
  const openByDefault = weekday >= 2 && weekday <= 6; // Tue–Sat
  return { open: openByDefault, start: "11:00", end: "19:00" };
}

function normalizeTime(t: string): string {
  return t.length >= 5 ? t.slice(0, 5) : t;
}

export interface BookingEditorProps {
  artist: ArtistProfile;
  variant?: "onboarding" | "settings";
}

export const BookingEditor = forwardRef<EditorHandle, BookingEditorProps>(
  function BookingEditor({ artist, variant = "onboarding" }, ref) {
    const { toast } = useToast();
    const { data: rules } = useAvailabilityRules(artist.id);
    const { data: blocks } = useAvailabilityBlocks(artist.id);
    const { data: policy } = useBookingPolicy(artist.id);
    const { createRule, deleteRule, createBlock, deleteBlock, upsertPolicy } =
      useAvailabilityMutations(artist.id);

    const [days, setDays] = useState<Record<number, DayState>>(() =>
      Object.fromEntries(WEEKDAYS.map((d) => [d.value, defaultDay(d.value)])),
    );
    const seededRules = useRef(false);

    const [bookingWindow, setBookingWindow] = useState<BookingWindow>("2_3mo");
    const [allowImages, setAllowImages] = useState(true);
    const [allowDocuments, setAllowDocuments] = useState(false);
    const seededPolicy = useRef(false);

    const [vacFrom, setVacFrom] = useState("");
    const [vacTo, setVacTo] = useState("");

    // Seed weekly hours from existing rules once.
    useEffect(() => {
      if (seededRules.current || !rules) return;
      seededRules.current = true;
      if (rules.length === 0) return;
      const next: Record<number, DayState> = Object.fromEntries(
        WEEKDAYS.map((d) => [d.value, { ...defaultDay(d.value), open: false }]),
      );
      for (const r of rules as AvailabilityRule[]) {
        next[r.weekday] = {
          open: r.is_open,
          start: normalizeTime(r.start_time),
          end: normalizeTime(r.end_time),
        };
      }
      setDays(next);
    }, [rules]);

    // Seed booking policy once.
    useEffect(() => {
      if (seededPolicy.current || policy === undefined) return;
      seededPolicy.current = true;
      if (policy) {
        setBookingWindow(policy.booking_window);
        setAllowImages(policy.allow_image_uploads);
        setAllowDocuments(policy.allow_document_uploads);
      }
    }, [policy]);

    function setDay(weekday: number, patch: Partial<DayState>) {
      setDays((prev) => {
        const cur = prev[weekday] ?? defaultDay(weekday);
        return { ...prev, [weekday]: { ...cur, ...patch } };
      });
    }

    async function addVacation() {
      if (!vacFrom || !vacTo) {
        toast({ title: "Enter both dates", variant: "danger" });
        return;
      }
      try {
        await createBlock.mutateAsync({
          block_type: "vacation",
          starts_at: new Date(vacFrom).toISOString(),
          ends_at: new Date(vacTo).toISOString(),
          is_available: false,
        });
        setVacFrom("");
        setVacTo("");
        toast({ title: "Time off added", variant: "success" });
      } catch (err) {
        toast({
          title: "Couldn't add",
          description: err instanceof Error ? err.message : "Try again.",
          variant: "danger",
        });
      }
    }

    async function save(): Promise<boolean> {
      try {
        await upsertPolicy.mutateAsync({
          booking_window: bookingWindow,
          allow_image_uploads: allowImages,
          allow_document_uploads: allowDocuments,
        });
        // Rebuild weekly rules from local state.
        if (rules) {
          for (const r of rules as AvailabilityRule[]) {
            await deleteRule.mutateAsync(r.id);
          }
        }
        for (const d of WEEKDAYS) {
          const day = days[d.value];
          if (day?.open) {
            await createRule.mutateAsync({
              weekday: d.value,
              start_time: day.start,
              end_time: day.end,
              is_open: true,
            });
          }
        }
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
        {/* Weekly hours */}
        <View className="gap-3">
          <Text className="text-sm font-sans-medium text-content-primary">Business hours</Text>
          <View className="divide-y divide-border-subtle rounded-xl border border-border-subtle">
            {WEEKDAYS.map((d) => {
              const day = days[d.value];
              return (
                <View key={d.value} className="gap-2.5 px-4 py-3">
                  <Toggle
                    checked={day?.open ?? false}
                    onCheckedChange={(v) => setDay(d.value, { open: v })}
                    label={d.short}
                  />
                  {day?.open ? (
                    <View className="flex-row items-center gap-2">
                      <View className="flex-1">
                        <PickerTimeField
                          value={day.start}
                          onValueChange={(v) => setDay(d.value, { start: v })}
                        />
                      </View>
                      <Text className="text-content-muted">–</Text>
                      <View className="flex-1">
                        <PickerTimeField
                          value={day.end}
                          onValueChange={(v) => setDay(d.value, { end: v })}
                        />
                      </View>
                    </View>
                  ) : (
                    <Text className="text-sm text-content-muted">Closed</Text>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {/* Vacation blocks */}
        <View className="gap-3">
          <Text className="text-sm font-sans-medium text-content-primary">Planned time off</Text>
          {blocks && blocks.length > 0 && (
            <View className="gap-2">
              {blocks.map((b) => (
                <View
                  key={b.id}
                  className="flex-row items-center justify-between rounded-lg border border-border-subtle bg-surface-raised/40 px-3.5 py-2.5"
                >
                  <View className="flex-row items-center gap-2.5">
                    <Icon name="calendar" size={15} color="#A1A1AA" />
                    <Text className="text-sm text-content-secondary">
                      {new Date(b.starts_at).toLocaleDateString()} –{" "}
                      {new Date(b.ends_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => deleteBlock.mutate(b.id)}
                    accessibilityRole="button"
                    accessibilityLabel="Remove time off"
                    className="h-7 w-7 items-center justify-center rounded-md"
                  >
                    <Icon name="x" size={15} color="#71717A" />
                  </Pressable>
                </View>
              ))}
            </View>
          )}
          <View className="flex-row items-center gap-2">
            <View className="flex-1">
              <PickerDateField value={vacFrom} onValueChange={setVacFrom} placeholder="From" />
            </View>
            <Text className="text-content-muted">–</Text>
            <View className="flex-1">
              <PickerDateField value={vacTo} onValueChange={setVacTo} placeholder="To" />
            </View>
            <Button
              variant="outline"
              size="sm"
              onPress={() => void addVacation()}
              loading={createBlock.isPending}
            >
              Add
            </Button>
          </View>
        </View>

        {/* Booking window */}
        <View className="gap-3">
          <Text className="text-sm font-sans-medium text-content-primary">
            How far out do your books open?
          </Text>
          <RadioGroup
            value={bookingWindow}
            onValueChange={(v) => setBookingWindow(v as BookingWindow)}
            options={BOOKING_WINDOWS.map((w) => ({
              label: w.label,
              value: w.value,
              description: w.description,
            }))}
          />
        </View>

        {/* Client upload options */}
        <View className="gap-3">
          <Text className="text-sm font-sans-medium text-content-primary">
            What can clients send when they book?
          </Text>
          <View className="gap-3 rounded-xl border border-border-subtle bg-surface-raised/40 px-4 py-3.5">
            <Toggle checked={allowImages} onCheckedChange={setAllowImages} label="Reference images" />
            <Toggle
              checked={allowDocuments}
              onCheckedChange={setAllowDocuments}
              label="Documents (IDs, consent forms)"
            />
          </View>
        </View>

        {variant === "settings" && (
          <View className="items-end">
            <Button onPress={() => void save()} loading={upsertPolicy.isPending}>
              Save changes
            </Button>
          </View>
        )}
      </View>
    );
  },
);
