"use client";

import { Chip } from "@inkd/ui/web";
import type { Style } from "@inkd/core";

/**
 * The style-taxonomy filter row. Chips are near-square placards (the design
 * system's `Chip` earns the one pill exception); selecting one filters the
 * stream to that style, "All" clears it. Horizontally scrollable on narrow
 * widths so the taxonomy never wraps into a wall of chips.
 */
export function StyleFilterChips({
  styles,
  selected,
  onSelect,
}: {
  styles: Style[];
  selected: string | null;
  onSelect: (slug: string | null) => void;
}) {
  return (
    <div
      className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="group"
      aria-label="Filter feed by style"
    >
      <Chip selected={selected === null} onClick={() => onSelect(null)}>
        All styles
      </Chip>
      {styles.map((style) => (
        <Chip
          key={style.id}
          selected={selected === style.slug}
          onClick={() => onSelect(selected === style.slug ? null : style.slug)}
          className="shrink-0"
        >
          {style.name}
        </Chip>
      ))}
    </div>
  );
}
