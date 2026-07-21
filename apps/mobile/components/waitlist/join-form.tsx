/**
 * Mobile "Join the waitlist" form. Uses tap-friendly preset chips for the date
 * window + time-of-day band (no fiddly pickers), weekday chips, an optional
 * service, and a note. Emits the `joinWaitlist` input shape.
 */
import { useState } from "react";
import { Text, View } from "react-native";
import { Button, Card, Chip, FormField, TextArea } from "@inkd/ui/native";
import type { CreateWaitlistEntryInput } from "@inkd/core";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function isoDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

const WINDOW_PRESETS: { key: string; label: string; earliest: string | null; latest: string | null }[] = [
  { key: "any", label: "Anytime", earliest: null, latest: null },
  { key: "2w", label: "Next 2 weeks", earliest: isoDate(0), latest: isoDate(14) },
  { key: "1m", label: "Next month", earliest: isoDate(0), latest: isoDate(30) },
  { key: "3m", label: "Next 3 months", earliest: isoDate(0), latest: isoDate(90) },
];

const TIME_PRESETS: { key: string; label: string; start: string | null; end: string | null }[] = [
  { key: "any", label: "Any time", start: null, end: null },
  { key: "am", label: "Morning", start: "08:00", end: "12:00" },
  { key: "pm", label: "Afternoon", start: "12:00", end: "17:00" },
  { key: "eve", label: "Evening", start: "17:00", end: "21:00" },
];

export interface WaitlistServiceOption {
  id: string;
  name: string;
}

export function WaitlistJoinForm({
  artistId,
  artistName,
  services = [],
  submitting = false,
  onSubmit,
}: {
  artistId: string;
  artistName?: string;
  services?: WaitlistServiceOption[];
  submitting?: boolean;
  onSubmit: (input: CreateWaitlistEntryInput) => void;
}) {
  const [serviceId, setServiceId] = useState<string>("");
  const [windowKey, setWindowKey] = useState("any");
  const [timeKey, setTimeKey] = useState("any");
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [note, setNote] = useState("");

  const toggleDay = (d: number) =>
    setWeekdays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));

  const submit = () => {
    const win = WINDOW_PRESETS.find((w) => w.key === windowKey)!;
    const time = TIME_PRESETS.find((t) => t.key === timeKey)!;
    onSubmit({
      artist_id: artistId,
      service_id: serviceId || null,
      earliest_date: win.earliest,
      latest_date: win.latest,
      preferred_weekdays: weekdays.length ? weekdays : null,
      preferred_time_start: time.start,
      preferred_time_end: time.end,
      note: note.trim() || null,
    });
  };

  return (
    <Card>
      <View className="gap-4">
        <View>
          <Text className="text-base font-semibold text-content-primary">
            Join {artistName ? `${artistName}'s` : "the"} waitlist
          </Text>
          <Text className="text-sm text-content-secondary">
            If a spot opens up that fits, we&apos;ll offer it to you first.
          </Text>
        </View>

        {services.length > 0 ? (
          <FormField label="Service (optional)">
            <View className="flex-row flex-wrap gap-1.5">
              <Chip selected={serviceId === ""} onPress={() => setServiceId("")}>
                Any
              </Chip>
              {services.map((s) => (
                <Chip key={s.id} selected={serviceId === s.id} onPress={() => setServiceId(s.id)}>
                  {s.name}
                </Chip>
              ))}
            </View>
          </FormField>
        ) : null}

        <FormField label="When">
          <View className="flex-row flex-wrap gap-1.5">
            {WINDOW_PRESETS.map((w) => (
              <Chip key={w.key} selected={windowKey === w.key} onPress={() => setWindowKey(w.key)}>
                {w.label}
              </Chip>
            ))}
          </View>
        </FormField>

        <FormField label="Preferred days" description="Leave empty for any day">
          <View className="flex-row flex-wrap gap-1.5">
            {WEEKDAYS.map((label, value) => (
              <Chip key={value} selected={weekdays.includes(value)} onPress={() => toggleDay(value)}>
                {label}
              </Chip>
            ))}
          </View>
        </FormField>

        <FormField label="Time of day">
          <View className="flex-row flex-wrap gap-1.5">
            {TIME_PRESETS.map((t) => (
              <Chip key={t.key} selected={timeKey === t.key} onPress={() => setTimeKey(t.key)}>
                {t.label}
              </Chip>
            ))}
          </View>
        </FormField>

        <FormField label="Note (optional)">
          <TextArea value={note} onChangeText={setNote} numberOfLines={2} placeholder="Anything the artist should know…" />
        </FormField>

        <Button hero className="w-full" onPress={submit} disabled={submitting}>
          Join the waitlist
        </Button>
      </View>
    </Card>
  );
}
