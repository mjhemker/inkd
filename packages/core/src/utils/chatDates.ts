/**
 * Pure date helpers for chat UI (day separators, list timestamps). Shared by
 * web + mobile so the "Today / Yesterday / Mon, Jan 5" logic never drifts
 * between platforms.
 */

/** Local calendar-day key (YYYY-MM-DD in the viewer's timezone). */
function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/** Human day-separator label: "Today", "Yesterday", or a short date. */
export function formatDayLabel(iso: string, now: Date = new Date()): string {
  const target = dayKey(iso);
  const today = dayKey(now.toISOString());
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (target === today) return "Today";
  if (target === dayKey(yesterday.toISOString())) return "Yesterday";

  const d = new Date(iso);
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  });
}

/** Short clock time for a message bubble, e.g. "2:41 PM". */
export function formatMessageTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Relative-ish short timestamp for a thread-list row: time for today, weekday
 * for the last week, short date otherwise.
 */
export function formatThreadTimestamp(iso: string, now: Date = new Date()): string {
  const target = dayKey(iso);
  const today = dayKey(now.toISOString());
  if (target === today) return formatMessageTime(iso);

  const d = new Date(iso);
  const diffDays = Math.round(
    (new Date(today).getTime() - new Date(target).getTime()) / 86_400_000,
  );
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString("en-US", { weekday: "short" });
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  });
}

export interface DayGroup<T> {
  dateKey: string;
  label: string;
  items: T[];
}

/** Group chronologically-ordered items with a `created_at` field into day buckets. */
export function groupByDay<T extends { created_at: string }>(
  items: T[],
  now: Date = new Date(),
): DayGroup<T>[] {
  const groups: DayGroup<T>[] = [];
  for (const item of items) {
    const key = dayKey(item.created_at);
    const last = groups[groups.length - 1];
    if (last && last.dateKey === key) {
      last.items.push(item);
    } else {
      groups.push({ dateKey: key, label: formatDayLabel(item.created_at, now), items: [item] });
    }
  }
  return groups;
}
