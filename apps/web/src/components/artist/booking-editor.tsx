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
  Toggle,
  useToast,
} from "@inkd/ui/web";
import type {
  ArtistProfile,
  AvailabilityRule,
  BookingWindow,
  WeeklyBlock,
} from "@inkd/core";
import { rulesToBlocks } from "@inkd/core";
import {
  useAvailabilityRules,
  useAvailabilityBlocks,
  useAvailabilityMutations,
  useBookingPolicy,
} from "@inkd/core/hooks";

import { BOOKING_WINDOWS } from "./constants";
import type { EditorHandle } from "./types";
import { WeeklyHoursGrid, type TimeOffSpan } from "../availability/WeeklyHoursGrid";

/** Default starter week for a brand-new artist: Tue–Sat, 11:00–19:00. */
function defaultBlocks(): WeeklyBlock[] {
  return [2, 3, 4, 5, 6].map((weekday) => ({
    weekday,
    start: "11:00",
    end: "19:00",
  }));
}

/**
 * Project date-range time-off blocks onto the weekly grid: any weekday whose
 * next occurrence (within `horizonDays`) is covered by a blocking span gets a
 * read-only shaded column labelled with that date.
 */
function timeOffSpans(
  blocks: { starts_at: string; ends_at: string; is_available: boolean }[] | undefined,
  horizonDays = 21,
): TimeOffSpan[] {
  if (!blocks || blocks.length === 0) return [];
  const out = new Map<number, string>();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < horizonDays; i++) {
    const day = new Date(today.getTime() + i * 86400000);
    const weekday = day.getDay();
    if (out.has(weekday)) continue;
    const dayStart = day.getTime();
    const dayEnd = dayStart + 86400000;
    const covered = blocks.some((b) => {
      if (b.is_available) return false;
      const bs = new Date(b.starts_at).getTime();
      const be = new Date(b.ends_at).getTime();
      return bs < dayEnd && be > dayStart;
    });
    if (covered) {
      out.set(
        weekday,
        `Off ${day.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`,
      );
    }
  }
  return [...out.entries()].map(([weekday, label]) => ({ weekday, label }));
}

export interface BookingEditorProps {
  artist: ArtistProfile;
  variant?: "onboarding" | "settings";
}

export const BookingEditor = forwardRef<EditorHandle, BookingEditorProps>(
  function BookingEditor({ artist, variant = "onboarding" }, ref) {
    const { toast } = useToast();
    const { data: rules } = useAvailabilityRules(artist.id);
    const { data: timeOffBlocks } = useAvailabilityBlocks(artist.id);
    const { data: policy } = useBookingPolicy(artist.id);
    const { reconcileRules, createBlock, deleteBlock, upsertPolicy } =
      useAvailabilityMutations(artist.id);

    const [blocks, setBlocks] = useState<WeeklyBlock[]>(() => defaultBlocks());
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
      setBlocks(rulesToBlocks(rules as AvailabilityRule[]));
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
        // Set-reconcile weekly rules: diff desired blocks against persisted rows
        // (insert new, update moved/resized, delete removed) — no blind rebuild.
        await reconcileRules.mutateAsync({
          existing: (rules ?? []) as AvailabilityRule[],
          desired: blocks,
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
        {/* Weekly hours grid */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-content-primary">
              Business hours
            </span>
            <span className="text-xs text-content-muted">
              Paint your open hours. Drag on a day to add a block; add several
              per day for split shifts. An empty day is closed.
            </span>
          </div>
          <WeeklyHoursGrid
            blocks={blocks}
            onChange={setBlocks}
            timeOff={timeOffSpans(timeOffBlocks)}
          />
        </div>

        {/* Vacation blocks */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-content-primary">
              Planned time off
            </span>
            <span className="text-xs text-content-muted">
              Optional — with flexible weekly hours you only need this for
              vacations or one-off closures. It shades those days on the grid
              above.
            </span>
          </div>
          {timeOffBlocks && timeOffBlocks.length > 0 && (
            <div className="flex flex-col gap-2">
              {timeOffBlocks.map((b) => (
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
