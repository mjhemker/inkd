import { ScrollView } from "react-native";
import { Chip } from "@inkd/ui/native";
import type { Style } from "@inkd/core";

export interface StyleFilterRowProps {
  styles: Style[];
  selectedSlug: string | null;
  onSelect: (slug: string | null) => void;
}

/** Horizontal style-chip filter row: an "All" chip clears the filter. */
export function StyleFilterRow({ styles, selectedSlug, onSelect }: StyleFilterRowProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="flex-row gap-2 px-6"
    >
      <Chip selected={selectedSlug === null} onPress={() => onSelect(null)}>
        All
      </Chip>
      {styles.map((style) => (
        <Chip
          key={style.id}
          selected={selectedSlug === style.slug}
          onPress={() => onSelect(selectedSlug === style.slug ? null : style.slug)}
        >
          {style.name}
        </Chip>
      ))}
    </ScrollView>
  );
}
