"use client";

import { Chip } from "@inkd/ui/web";
import { useStyles, type Style } from "@inkd/core";

/** Multi-select chip picker sourced from the canonical styles taxonomy. */
export function StyleChipPicker({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (styleId: string) => void;
}) {
  const { data: styles, isLoading } = useStyles();

  if (isLoading) {
    return <p className="text-sm text-content-muted">Loading styles…</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {(styles ?? []).map((style: Style) => (
        <Chip
          key={style.id}
          selected={selected.includes(style.id)}
          onClick={() => onToggle(style.id)}
        >
          {style.name}
        </Chip>
      ))}
    </div>
  );
}
