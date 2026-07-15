import { Text, View } from "react-native";
import { Chip } from "@inkd/ui/native";
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
    return <Text className="text-sm text-content-muted">Loading styles…</Text>;
  }

  return (
    <View className="flex-row flex-wrap gap-2">
      {(styles ?? []).map((style: Style) => (
        <Chip key={style.id} selected={selected.includes(style.id)} onPress={() => onToggle(style.id)}>
          {style.name}
        </Chip>
      ))}
    </View>
  );
}
