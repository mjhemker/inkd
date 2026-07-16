import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Pressable, Text, View } from "react-native";
import { Button, Icon, RadioGroup, Toggle, useToast } from "@inkd/ui/native";
import type {
  ArtistProfile,
  AvailabilityRule,
  BookingWindow,
  WeeklyBlock,
} from "@inkd/core";
import {
  BOOKING_WINDOWS,
  DAY_MINUTES,
  WEEKDAYS,
  minutesToTime,
  rulesToBlocks,
  timeToMinutes,
} from "@inkd/core";
import {
  useAvailabilityRules,
  useAvailabilityBlocks,
  useAvailabilityMutations,
  useBookingPolicy,
} from "@inkd/core/hooks";

import { PickerDateField, PickerTimeField } from "./pickers";
import type { EditorHandle } from "./types";
import { useTheme } from "@/providers/theme";

/** Default starter week for a brand-new artist: Tue–Sat, 11:00–19:00. */
function defaultBlocks(): WeeklyBlock[] {
  return [2, 3, 4, 5, 6].map((weekday) => ({
    weekday,
    start: "11:00",
    end: "19:00",
  }));
}

export interface BookingEditorProps {
  artist: ArtistProfile;
  variant?: "onboarding" | "settings";
}

export const BookingEditor = forwardRef<EditorHandle, BookingEditorProps>(
  function BookingEditor({ artist, variant = "onboarding" }, ref) {
    const { colors } = useTheme();
    const { toast } = useToast();
    const { data: rules } = useAvailabilityRules(artist.id);
    const { data: blocks } = useAvailabilityBlocks(artist.id);
    const { data: policy } = useBookingPolicy(artist.id);
    const { reconcileRules, createBlock, deleteBlock, upsertPolicy } =
      useAvailabilityMutations(artist.id);

    const [weekBlocks, setWeekBlocks] = useState<WeeklyBlock[]>(() => defaultBlocks());
    const seededRules = useRef(false);

    const [bookingWindow, setBookingWindow] = useState<BookingWindow>("2_3mo");
    const [allowImages, setAllowImages] = useState(true);
    const [allowDocuments, setAllowDocuments] = useState(false);
    const seededPolicy = useRef(false);

    const [vacFrom, setVacFrom] = useState("");
    const [vacTo, setVacTo] = useState("");

    // Seed weekly hours from existing rules once (empty = keep the starter week).
    useEffect(() => {
      if (seededRules.current || !rules) return;
      seededRules.current = true;
      if (rules.length === 0) return;
      setWeekBlocks(rulesToBlocks(rules as AvailabilityRule[]));
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

    function updateBlock(index: number, patch: Partial<WeeklyBlock>) {
      setWeekBlocks((prev) => {
        const next = [...prev];
        const cur = next[index];
        if (!cur) return prev;
        const merged = { ...cur, ...patch };
        // Keep end > start; ignore edits that would produce an invalid window.
        if (timeToMinutes(merged.end) <= timeToMinutes(merged.start)) return prev;
        next[index] = merged;
        return next;
      });
    }

    function removeBlock(index: number) {
      setWeekBlocks((prev) => prev.filter((_, i) => i !== index));
    }

    function addBlock(weekday: number) {
      setWeekBlocks((prev) => {
        const dayBlocks = prev.filter((b) => b.weekday === weekday);
        let start = 11 * 60;
        let end = 15 * 60;
        if (dayBlocks.length > 0) {
          const lastEnd = Math.max(...dayBlocks.map((b) => timeToMinutes(b.end)));
          start = Math.min(lastEnd, DAY_MINUTES - 60);
          end = Math.min(start + 240, DAY_MINUTES);
        }
        return [
          ...prev,
          { weekday, start: minutesToTime(start), end: minutesToTime(end) },
        ];
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
        // Set-reconcile weekly rules: diff desired blocks against persisted rows
        // (insert new, update moved/resized, delete removed) — no blind rebuild.
        await reconcileRules.mutateAsync({
          existing: (rules ?? []) as AvailabilityRule[],
          desired: weekBlocks,
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
        {/* Weekly hours */}
        <View className="gap-3">
          <View className="gap-0.5">
            <Text className="text-sm font-sans-medium text-content-primary">Business hours</Text>
            <Text className="text-xs text-content-muted">
              Add one or more blocks per day for split shifts. An empty day is closed.
            </Text>
          </View>
          <View className="divide-y divide-border-subtle rounded-xl border border-border-subtle">
            {WEEKDAYS.map((d) => {
              const dayBlocks = weekBlocks
                .map((b, index) => ({ b, index }))
                .filter(({ b }) => b.weekday === d.value)
                .sort((a, z) => timeToMinutes(a.b.start) - timeToMinutes(z.b.start));
              return (
                <View key={d.value} className="gap-2.5 px-4 py-3">
                  <Text className="text-sm font-sans-medium text-content-primary">
                    {d.short ?? d.label}
                  </Text>
                  {dayBlocks.length > 0 ? (
                    <View className="gap-2">
                      {dayBlocks.map(({ b, index }) => (
                        <View key={index} className="flex-row items-center gap-2">
                          <View className="flex-1">
                            <PickerTimeField
                              value={b.start}
                              onValueChange={(v) => updateBlock(index, { start: v })}
                            />
                          </View>
                          <Text className="text-content-muted">–</Text>
                          <View className="flex-1">
                            <PickerTimeField
                              value={b.end}
                              onValueChange={(v) => updateBlock(index, { end: v })}
                            />
                          </View>
                          <Pressable
                            onPress={() => removeBlock(index)}
                            accessibilityRole="button"
                            accessibilityLabel="Remove block"
                            className="h-7 w-7 items-center justify-center rounded-md"
                          >
                            <Icon name="x" size={15} color={colors.text.muted} />
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text className="text-sm text-content-muted">Closed</Text>
                  )}
                  <View className="items-start">
                    <Button variant="outline" size="sm" onPress={() => addBlock(d.value)}>
                      + Add block
                    </Button>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Vacation blocks */}
        <View className="gap-3">
          <View className="gap-0.5">
            <Text className="text-sm font-sans-medium text-content-primary">Planned time off</Text>
            <Text className="text-xs text-content-muted">
              Optional — with flexible weekly hours you only need this for vacations or one-off
              closures.
            </Text>
          </View>
          {blocks && blocks.length > 0 && (
            <View className="gap-2">
              {blocks.map((b) => (
                <View
                  key={b.id}
                  className="flex-row items-center justify-between rounded-lg border border-border-subtle bg-surface-raised/40 px-3.5 py-2.5"
                >
                  <View className="flex-row items-center gap-2.5">
                    <Icon name="calendar" size={15} color={colors.text.secondary} />
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
                    <Icon name="x" size={15} color={colors.text.muted} />
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
