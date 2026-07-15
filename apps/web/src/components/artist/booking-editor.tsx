"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  Button,
  DateField,
  Icon,
  RadioGroup,
  TimeField,
  Toggle,
  useToast,
} from "@inkd/ui/web";
import type {
  ArtistProfile,
  AvailabilityRule,
  BookingWindow,
} from "@inkd/core";
import {
  useAvailabilityRules,
  useAvailabilityBlocks,
  useAvailabilityMutations,
  useBookingPolicy,
} from "@inkd/core/hooks";

import { BOOKING_WINDOWS, WEEKDAYS } from "./constants";
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
    const {
      createRule,
      deleteRule,
      createBlock,
      deleteBlock,
      upsertPolicy,
    } = useAvailabilityMutations(artist.id);

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
        toast({ title: "Pick both dates", variant: "danger" });
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
      <div className="flex flex-col gap-8">
        {/* Weekly hours */}
        <div className="flex flex-col gap-3">
          <span className="text-sm font-medium text-content-primary">
            Business hours
          </span>
          <div className="flex flex-col divide-y divide-border-subtle rounded-xl border border-border-subtle">
            {WEEKDAYS.map((d) => {
              const day = days[d.value];
              return (
                <div
                  key={d.value}
                  className="flex items-center gap-3 px-4 py-2.5"
                >
                  <div className="w-24">
                    <Toggle
                      checked={day?.open ?? false}
                      onCheckedChange={(v) => setDay(d.value, { open: v })}
                      label={d.short}
                    />
                  </div>
                  {day?.open ? (
                    <div className="flex flex-1 items-center gap-2">
                      <TimeField
                        size="sm"
                        value={day.start}
                        onChange={(e) => setDay(d.value, { start: e.target.value })}
                      />
                      <span className="text-content-muted">–</span>
                      <TimeField
                        size="sm"
                        value={day.end}
                        onChange={(e) => setDay(d.value, { end: e.target.value })}
                      />
                    </div>
                  ) : (
                    <span className="flex-1 text-sm text-content-muted">Closed</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Vacation blocks */}
        <div className="flex flex-col gap-3">
          <span className="text-sm font-medium text-content-primary">
            Planned time off
          </span>
          {blocks && blocks.length > 0 && (
            <div className="flex flex-col gap-2">
              {blocks.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between rounded-lg border border-border-subtle bg-surface-raised/40 px-3.5 py-2.5"
                >
                  <span className="flex items-center gap-2.5 text-sm text-content-secondary">
                    <Icon name="calendar" size={15} />
                    {new Date(b.starts_at).toLocaleDateString()} –{" "}
                    {new Date(b.ends_at).toLocaleDateString()}
                  </span>
                  <button
                    type="button"
                    onClick={() => deleteBlock.mutate(b.id)}
                    className="grid h-7 w-7 place-items-center rounded-md text-content-muted outline-none transition-colors hover:text-danger-500 focus-visible:ring-2 focus-visible:ring-brand"
                    aria-label="Remove time off"
                  >
                    <Icon name="x" size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <DateField
                size="sm"
                value={vacFrom}
                onChange={(e) => setVacFrom(e.target.value)}
              />
            </div>
            <span className="pb-2 text-content-muted">–</span>
            <div className="flex-1">
              <DateField
                size="sm"
                value={vacTo}
                onChange={(e) => setVacTo(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void addVacation()}
              loading={createBlock.isPending}
            >
              Add
            </Button>
          </div>
        </div>

        {/* Booking window */}
        <div className="flex flex-col gap-3">
          <span className="text-sm font-medium text-content-primary">
            How far out do your books open?
          </span>
          <RadioGroup
            value={bookingWindow}
            onValueChange={(v) => setBookingWindow(v as BookingWindow)}
            options={BOOKING_WINDOWS.map((w) => ({
              label: w.label,
              value: w.value,
              description: w.description,
            }))}
          />
        </div>

        {/* Client upload options */}
        <div className="flex flex-col gap-3">
          <span className="text-sm font-medium text-content-primary">
            What can clients send when they book?
          </span>
          <div className="flex flex-col gap-3 rounded-xl border border-border-subtle bg-surface-raised/40 px-4 py-3.5">
            <Toggle
              checked={allowImages}
              onCheckedChange={setAllowImages}
              label="Reference images"
            />
            <Toggle
              checked={allowDocuments}
              onCheckedChange={setAllowDocuments}
              label="Documents (IDs, consent forms)"
            />
          </div>
        </div>

        {variant === "settings" && (
          <div className="flex justify-end">
            <Button onClick={() => void save()} loading={upsertPolicy.isPending}>
              Save changes
            </Button>
          </div>
        )}
      </div>
    );
  },
);
