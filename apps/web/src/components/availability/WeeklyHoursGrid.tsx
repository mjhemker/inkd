"use client";

/**
 * WeeklyHoursGrid — a Google-Calendar / Calendly-style weekly availability
 * editor. Seven day columns (Mon–Sun) share a vertical hour axis; the artist
 * paints their open hours directly onto the grid:
 *
 *   • click-and-drag on empty space  → create a block
 *   • drag a block body               → move it
 *   • drag a block's top/bottom edge  → resize it
 *   • click a block                   → popover with exact start/end + delete
 *   • keyboard (focus a block)        → ↑/↓ nudge, Shift+↑/↓ resize, ⌫ delete
 *
 * Multiple blocks per day are first-class. An empty day is simply closed — no
 * toggle. Everything snaps to 15 minutes; overlaps within a day are merged on
 * commit. The component is fully controlled: it renders `blocks` and emits the
 * next block list through `onChange` (already merged/snapped). All persistence
 * lives in the parent via @inkd/core's set-reconciliation.
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button, Icon, TimeField } from "@inkd/ui/web";
import {
  WEEKDAYS,
  DAY_MINUTES,
  SNAP_MINUTES,
  hasOverlap,
  mergeWeeklyBlocks,
  minutesToTime,
  snapMinutes,
  timeToMinutes,
  type WeeklyBlock,
} from "@inkd/core";

/** A read-only shaded span (planned time off) projected onto a weekday column. */
export interface TimeOffSpan {
  weekday: number;
  label: string;
}

export interface WeeklyHoursGridProps {
  blocks: WeeklyBlock[];
  onChange: (next: WeeklyBlock[]) => void;
  /** Read-only shaded spans (time off) drawn behind the grid. */
  timeOff?: TimeOffSpan[];
  /** Hour the scroll viewport starts at (default 6:00). */
  scrollToHour?: number;
  /** Minimum block length in minutes (default 30). */
  minBlockMinutes?: number;
}

const HOUR_PX = 44; // vertical pixels per hour
const GRID_TOP_MIN = 0;
const GRID_BOTTOM_MIN = DAY_MINUTES;
const TOTAL_PX = ((GRID_BOTTOM_MIN - GRID_TOP_MIN) / 60) * HOUR_PX;
const EDGE_PX = 8; // resize-handle hit zone

type DragKind = "create" | "move" | "resize-top" | "resize-bottom";

interface DragState {
  kind: DragKind;
  key: string;
  weekday: number;
  /** Live start/end in minutes during the drag. */
  start: number;
  end: number;
  /** For move: pointer offset (minutes) from block start at grab time. */
  grabOffset: number;
  /** Fixed anchor edge (minutes) for create/resize. */
  anchor: number;
  moved: boolean;
}

function minutesFromClientY(clientY: number, columnEl: HTMLElement): number {
  const rect = columnEl.getBoundingClientRect();
  const px = clientY - rect.top;
  return GRID_TOP_MIN + (px / HOUR_PX) * 60;
}

let tmpCounter = 0;
function tmpId(): string {
  tmpCounter += 1;
  return `tmp-${Date.now().toString(36)}-${tmpCounter}`;
}

export function WeeklyHoursGrid({
  blocks,
  onChange,
  timeOff = [],
  scrollToHour = 6,
  minBlockMinutes = 30,
}: WeeklyHoursGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const columnRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");

  // Ensure every block has a stable key (assign temp ids to new blocks once).
  const keyed = useMemo(() => {
    return blocks.map((b) => (b.id ? b : { ...b, id: tmpId() }));
  }, [blocks]);

  // Scroll the viewport to the working hours on mount.
  useLayoutEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = (scrollToHour / 24) * TOTAL_PX;
    }
  }, [scrollToHour]);

  const timeOffByDay = useMemo(() => {
    const m = new Map<number, string>();
    for (const t of timeOff) if (!m.has(t.weekday)) m.set(t.weekday, t.label);
    return m;
  }, [timeOff]);

  const commit = useCallback(
    (next: WeeklyBlock[], message?: string) => {
      const merged = mergeWeeklyBlocks(next);
      onChange(merged);
      if (message) setAnnounce(message);
    },
    [onChange],
  );

  // --- pointer drag lifecycle ------------------------------------------------
  useEffect(() => {
    if (!drag) return;
    function onMove(e: PointerEvent) {
      const cur = dragRef.current;
      if (!cur) return;
      const colEl = columnRefs.current[cur.weekday];
      if (!colEl) return;
      const raw = snapMinutes(minutesFromClientY(e.clientY, colEl));
      const next: DragState = { ...cur, moved: true };
      if (cur.kind === "create" || cur.kind === "resize-bottom") {
        next.end = Math.max(cur.anchor + SNAP_MINUTES, Math.min(GRID_BOTTOM_MIN, raw));
        next.start = cur.kind === "create" ? cur.anchor : cur.start;
      } else if (cur.kind === "resize-top") {
        next.start = Math.min(cur.anchor - SNAP_MINUTES, Math.max(GRID_TOP_MIN, raw));
        next.end = cur.anchor;
      } else if (cur.kind === "move") {
        const len = cur.end - cur.start;
        let s = snapMinutes(raw - cur.grabOffset);
        s = Math.max(GRID_TOP_MIN, Math.min(GRID_BOTTOM_MIN - len, s));
        next.start = s;
        next.end = s + len;
      }
      dragRef.current = next;
      setDrag(next);
    }
    function onUp() {
      const cur = dragRef.current;
      dragRef.current = null;
      setDrag(null);
      if (!cur) return;
      // A clean click (no move) on an existing block opens its popover.
      if (!cur.moved && cur.kind !== "create") {
        setOpenKey(cur.key);
        return;
      }
      if (cur.kind === "create" && !cur.moved) return; // stray click on empty grid
      const start = minutesToTime(cur.start);
      const end = minutesToTime(cur.end);
      if (timeToMinutes(end) - timeToMinutes(start) < minBlockMinutes) return;
      const others = keyed.filter((b) => b.id !== cur.key);
      const candidate: WeeklyBlock = {
        id: cur.kind === "create" ? undefined : cur.key,
        weekday: cur.weekday,
        start,
        end,
      };
      const overlaps = hasOverlap(candidate, keyed, cur.kind === "create" ? undefined : cur.key);
      const nextBlocks =
        cur.kind === "create" ? [...keyed, candidate] : [...others, candidate];
      commit(
        nextBlocks,
        overlaps
          ? `Merged overlapping block on ${dayLabel(cur.weekday)}.`
          : `${cur.kind === "create" ? "Added" : "Updated"} ${dayLabel(cur.weekday)} ${start}–${end}.`,
      );
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [drag, keyed, commit, minBlockMinutes]);

  function startCreate(weekday: number, e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    const colEl = columnRefs.current[weekday];
    if (!colEl) return;
    const at = snapMinutes(minutesFromClientY(e.clientY, colEl));
    const st: DragState = {
      kind: "create",
      key: tmpId(),
      weekday,
      start: at,
      end: at + SNAP_MINUTES,
      grabOffset: 0,
      anchor: at,
      moved: false,
    };
    dragRef.current = st;
    setDrag(st);
    setOpenKey(null);
  }

  function startBlock(
    block: WeeklyBlock,
    kind: DragKind,
    e: React.PointerEvent<HTMLDivElement>,
  ) {
    if (e.button !== 0) return;
    e.stopPropagation();
    const colEl = columnRefs.current[block.weekday];
    if (!colEl) return;
    const at = minutesFromClientY(e.clientY, colEl);
    const s = timeToMinutes(block.start);
    const en = timeToMinutes(block.end);
    const st: DragState = {
      kind,
      key: block.id!,
      weekday: block.weekday,
      start: s,
      end: en,
      grabOffset: at - s,
      anchor: kind === "resize-top" ? en : s,
      moved: false,
    };
    dragRef.current = st;
    setDrag(st);
    setOpenKey(null);
  }

  // --- keyboard nudge --------------------------------------------------------
  function onBlockKeyDown(block: WeeklyBlock, e: React.KeyboardEvent) {
    const s = timeToMinutes(block.start);
    const en = timeToMinutes(block.end);
    const others = keyed.filter((b) => b.id !== block.id);
    const apply = (ns: number, ne: number, verb: string) => {
      const start = minutesToTime(ns);
      const end = minutesToTime(ne);
      commit([...others, { ...block, start, end }], `${verb} to ${start}–${end}.`);
    };
    if (e.key === "ArrowUp" && e.shiftKey) {
      e.preventDefault();
      if (en - s > minBlockMinutes) apply(s, en - SNAP_MINUTES, "Shortened");
    } else if (e.key === "ArrowDown" && e.shiftKey) {
      e.preventDefault();
      if (en + SNAP_MINUTES <= GRID_BOTTOM_MIN) apply(s, en + SNAP_MINUTES, "Lengthened");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (s - SNAP_MINUTES >= GRID_TOP_MIN) apply(s - SNAP_MINUTES, en - SNAP_MINUTES, "Moved");
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (en + SNAP_MINUTES <= GRID_BOTTOM_MIN) apply(s + SNAP_MINUTES, en + SNAP_MINUTES, "Moved");
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      commit(others, `Removed ${dayLabel(block.weekday)} block.`);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpenKey(block.id ?? null);
    }
  }

  function updateBlockTimes(block: WeeklyBlock, start: string, end: string) {
    if (timeToMinutes(end) <= timeToMinutes(start)) return;
    const others = keyed.filter((b) => b.id !== block.id);
    commit([...others, { ...block, start, end }], `Set ${dayLabel(block.weekday)} ${start}–${end}.`);
  }

  function removeBlock(block: WeeklyBlock) {
    const others = keyed.filter((b) => b.id !== block.id);
    commit(others, `Removed ${dayLabel(block.weekday)} block.`);
    setOpenKey(null);
  }

  const hourMarks = Array.from({ length: 25 }, (_, h) => h);

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={scrollRef}
        className="relative max-h-[26rem] overflow-y-auto rounded-xl border border-border-subtle bg-surface-raised/30"
      >
        <div className="flex">
          {/* Hour axis */}
          <div className="sticky left-0 z-10 w-12 shrink-0 bg-surface-base/80 backdrop-blur-sm">
            <div className="h-9" aria-hidden />
            <div className="relative" style={{ height: TOTAL_PX }}>
              {hourMarks.map((h) => (
                <div
                  key={h}
                  className="absolute right-2 -translate-y-1/2 text-[10px] tabular-nums text-content-muted"
                  style={{ top: (h / 24) * TOTAL_PX }}
                >
                  {h === 24 ? "" : `${String(h).padStart(2, "0")}:00`}
                </div>
              ))}
            </div>
          </div>

          {/* Day columns */}
          <div className="flex flex-1">
            {WEEKDAYS.map((d) => {
              const dayBlocks = keyed.filter((b) => b.weekday === d.value);
              const off = timeOffByDay.get(d.value);
              const isDragCol = drag && drag.weekday === d.value;
              return (
                <div key={d.value} className="flex min-w-0 flex-1 flex-col border-l border-border-subtle first:border-l-0">
                  {/* Column header */}
                  <div className="sticky top-0 z-10 flex h-9 items-center justify-center border-b border-border-subtle bg-surface-base/90 text-xs font-medium text-content-secondary backdrop-blur-sm">
                    {d.short}
                  </div>
                  {/* Column body */}
                  <div
                    ref={(el) => {
                      columnRefs.current[d.value] = el;
                    }}
                    onPointerDown={(e) => startCreate(d.value, e)}
                    className="relative touch-none select-none"
                    style={{ height: TOTAL_PX }}
                    role="group"
                    aria-label={`${d.label} hours`}
                  >
                    {/* Hour gridlines */}
                    {hourMarks.map((h) => (
                      <div
                        key={h}
                        className="pointer-events-none absolute inset-x-0 border-t border-border-subtle/60"
                        style={{ top: (h / 24) * TOTAL_PX }}
                        aria-hidden
                      />
                    ))}

                    {/* Time-off shading (read-only) */}
                    {off && (
                      <div
                        className="pointer-events-none absolute inset-0 flex items-start justify-center bg-[repeating-linear-gradient(45deg,rgba(148,148,163,0.12)_0,rgba(148,148,163,0.12)_6px,transparent_6px,transparent_12px)]"
                        aria-hidden
                      >
                        <span className="mt-2 rounded bg-surface-base/80 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-content-muted">
                          {off}
                        </span>
                      </div>
                    )}

                    {/* Blocks */}
                    {dayBlocks.map((b) => {
                      const live =
                        drag && drag.key === b.id
                          ? { start: drag.start, end: drag.end }
                          : { start: timeToMinutes(b.start), end: timeToMinutes(b.end) };
                      const top = (live.start / DAY_MINUTES) * TOTAL_PX;
                      const height = ((live.end - live.start) / DAY_MINUTES) * TOTAL_PX;
                      return (
                        <div key={b.id} className="absolute inset-x-1" style={{ top, height }}>
                          <div
                            role="button"
                            tabIndex={0}
                            aria-label={`${d.label} ${minutesToTime(live.start)} to ${minutesToTime(live.end)}. Arrow keys to move, Shift plus arrows to resize, Delete to remove, Enter to edit.`}
                            onPointerDown={(e) => startBlock(b, "move", e)}
                            onKeyDown={(e) => onBlockKeyDown(b, e)}
                            className="group relative h-full w-full cursor-grab overflow-hidden rounded-lg border border-brand/50 bg-brand/25 text-[10px] font-medium text-content-primary outline-none ring-brand transition-colors hover:bg-brand/35 focus-visible:ring-2 active:cursor-grabbing"
                          >
                            {/* top resize handle */}
                            <div
                              onPointerDown={(e) => startBlock(b, "resize-top", e)}
                              className="absolute inset-x-0 top-0 h-2 cursor-ns-resize"
                              style={{ height: EDGE_PX }}
                              aria-hidden
                            />
                            <div className="pointer-events-none px-1.5 py-1 leading-tight">
                              {minutesToTime(live.start)}–{minutesToTime(live.end)}
                            </div>
                            {/* bottom resize handle */}
                            <div
                              onPointerDown={(e) => startBlock(b, "resize-bottom", e)}
                              className="absolute inset-x-0 bottom-0 cursor-ns-resize"
                              style={{ height: EDGE_PX }}
                              aria-hidden
                            />
                          </div>

                          {/* Popover */}
                          {openKey === b.id && !drag && (
                            <BlockPopover
                              block={b}
                              onClose={() => setOpenKey(null)}
                              onSave={(s, e) => updateBlockTimes(b, s, e)}
                              onDelete={() => removeBlock(b)}
                            />
                          )}
                        </div>
                      );
                    })}

                    {/* Live create ghost */}
                    {isDragCol && drag?.kind === "create" && (
                      <div
                        className="pointer-events-none absolute inset-x-1 rounded-lg border border-brand bg-brand/30"
                        style={{
                          top: (drag.start / DAY_MINUTES) * TOTAL_PX,
                          height: ((drag.end - drag.start) / DAY_MINUTES) * TOTAL_PX,
                        }}
                      >
                        <div className="px-1.5 py-1 text-[10px] font-medium text-content-primary">
                          {minutesToTime(drag.start)}–{minutesToTime(drag.end)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <p className="text-xs text-content-muted">
        Drag on a day to add hours. Drag a block to move it, or its edges to
        resize. Click a block to set exact times. An empty day is closed.
      </p>
      <div aria-live="polite" className="sr-only">
        {announce}
      </div>
    </div>
  );
}

function dayLabel(weekday: number): string {
  return WEEKDAYS.find((d) => d.value === weekday)?.short ?? "";
}

function BlockPopover({
  block,
  onClose,
  onSave,
  onDelete,
}: {
  block: WeeklyBlock;
  onClose: () => void;
  onSave: (start: string, end: string) => void;
  onDelete: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [start, setStart] = useState(block.start);
  const [end, setEnd] = useState(block.end);
  const invalid = timeToMinutes(end) <= timeToMinutes(start);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Edit hours block"
      onPointerDown={(e) => e.stopPropagation()}
      className="absolute left-1/2 top-full z-30 mt-1 w-52 -translate-x-1/2 rounded-xl border border-border-subtle bg-surface-base p-3 shadow-lg"
    >
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <TimeField
            size="sm"
            value={start}
            invalid={invalid}
            onChange={(e) => setStart(e.target.value)}
            aria-label="Start time"
          />
        </div>
        <span className="text-content-muted">–</span>
        <div className="flex-1">
          <TimeField
            size="sm"
            value={end}
            invalid={invalid}
            onChange={(e) => setEnd(e.target.value)}
            aria-label="End time"
          />
        </div>
      </div>
      <div className="mt-2.5 flex items-center justify-between">
        <button
          type="button"
          onClick={onDelete}
          className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-danger-500 outline-none transition-colors hover:bg-danger-500/10 focus-visible:ring-2 focus-visible:ring-brand"
        >
          <Icon name="x" size={13} /> Delete
        </button>
        <Button
          size="sm"
          disabled={invalid}
          onClick={() => {
            onSave(start, end);
            onClose();
          }}
        >
          Done
        </Button>
      </div>
    </div>
  );
}
