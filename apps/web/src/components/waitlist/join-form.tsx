"use client";

/**
 * "Join the waitlist" form — a client picks a desired window (optional service,
 * date range, preferred weekdays + time-of-day band) and a note. Self-contained
 * local state; calls `onSubmit` with the shape `joinWaitlist` expects. Shown
 * from an artist's profile / booking flow when the time they want isn't open.
 */
import { useState } from "react";
import {
  Button,
  Card,
  Chip,
  DateField,
  FormField,
  Select,
  TextArea,
  TimeField,
} from "@inkd/ui/web";
import type { CreateWaitlistEntryInput } from "@inkd/core";
import { WEEKDAY_OPTIONS } from "./shared";

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
  onCancel,
}: {
  artistId: string;
  artistName?: string;
  services?: WaitlistServiceOption[];
  submitting?: boolean;
  onSubmit: (input: CreateWaitlistEntryInput) => void;
  onCancel?: () => void;
}) {
  const [serviceId, setServiceId] = useState("");
  const [earliest, setEarliest] = useState("");
  const [latest, setLatest] = useState("");
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [timeStart, setTimeStart] = useState("");
  const [timeEnd, setTimeEnd] = useState("");
  const [note, setNote] = useState("");

  const toggleDay = (d: number) =>
    setWeekdays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));

  const submit = () => {
    onSubmit({
      artist_id: artistId,
      service_id: serviceId || null,
      earliest_date: earliest || null,
      latest_date: latest || null,
      preferred_weekdays: weekdays.length ? weekdays : null,
      preferred_time_start: timeStart || null,
      preferred_time_end: timeEnd || null,
      note: note.trim() || null,
    });
  };

  return (
    <Card>
      <div className="flex flex-col gap-4 p-5">
        <div>
          <h3 className="text-base font-semibold text-content">
            Join {artistName ? `${artistName}'s` : "the"} waitlist
          </h3>
          <p className="text-sm text-content-muted">
            Tell us when works. If a spot opens up that fits, we&apos;ll offer it to you first.
          </p>
        </div>

        {services.length > 0 ? (
          <FormField label="Service (optional)">
            <Select
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              placeholder="Any service"
              options={services.map((s) => ({ label: s.name, value: s.id }))}
            />
          </FormField>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Earliest date">
            <DateField value={earliest} onChange={(e) => setEarliest(e.target.value)} />
          </FormField>
          <FormField label="Latest date">
            <DateField value={latest} onChange={(e) => setLatest(e.target.value)} />
          </FormField>
        </div>

        <FormField label="Preferred days" description="Leave empty for any day">
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAY_OPTIONS.map((d) => (
              <Chip
                key={d.value}
                selected={weekdays.includes(d.value)}
                onClick={() => toggleDay(d.value)}
              >
                {d.label}
              </Chip>
            ))}
          </div>
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Earliest time">
            <TimeField value={timeStart} onChange={(e) => setTimeStart(e.target.value)} />
          </FormField>
          <FormField label="Latest time">
            <TimeField value={timeEnd} onChange={(e) => setTimeEnd(e.target.value)} />
          </FormField>
        </div>

        <FormField label="Note (optional)">
          <TextArea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Anything the artist should know…"
          />
        </FormField>

        <div className="flex gap-2">
          <Button hero onClick={submit} disabled={submitting} className="flex-1">
            Join the waitlist
          </Button>
          {onCancel ? (
            <Button variant="ghost" onClick={onCancel} disabled={submitting}>
              Cancel
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
