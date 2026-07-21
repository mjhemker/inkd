import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Chip, Icon, Input } from "@inkd/ui/native";

import { useTheme } from "@/providers/theme";

export interface StyleOption {
  key: string;
  label: string;
  /** True for styles pulled from the artist's profile or recently used — these
   * are surfaced first under a "Suggested" heading. */
  suggested?: boolean;
}

/**
 * Style picker for the Add flows: shows suggested styles (from the artist's
 * profile styles + most-recently-used) first, the rest of the taxonomy below,
 * and a free-text "add your own" field for one-off tags. Known styles toggle by
 * `key`; custom entries are free strings the caller persists however it likes.
 */
export function StyleSuggestInput({
  options,
  selectedKeys,
  onToggleKey,
  customTags,
  onAddCustom,
  onRemoveCustom,
}: {
  options: StyleOption[];
  selectedKeys: string[];
  onToggleKey: (key: string) => void;
  customTags: string[];
  onAddCustom: (text: string) => void;
  onRemoveCustom: (text: string) => void;
}) {
  const { colors } = useTheme();
  const [draft, setDraft] = useState("");

  const suggested = options.filter((o) => o.suggested);
  const rest = options.filter((o) => !o.suggested);

  function commitDraft() {
    const value = draft.trim();
    if (!value) return;
    onAddCustom(value);
    setDraft("");
  }

  return (
    <View className="gap-4">
      {suggested.length > 0 && (
        <View className="gap-2">
          <Text className="font-mono text-xs uppercase text-content-muted">Suggested</Text>
          <View className="flex-row flex-wrap gap-2">
            {suggested.map((o) => (
              <Chip key={o.key} selected={selectedKeys.includes(o.key)} onPress={() => onToggleKey(o.key)}>
                {o.label}
              </Chip>
            ))}
          </View>
        </View>
      )}

      {rest.length > 0 && (
        <View className="gap-2">
          {suggested.length > 0 && (
            <Text className="font-mono text-xs uppercase text-content-muted">All styles</Text>
          )}
          <View className="flex-row flex-wrap gap-2">
            {rest.map((o) => (
              <Chip key={o.key} selected={selectedKeys.includes(o.key)} onPress={() => onToggleKey(o.key)}>
                {o.label}
              </Chip>
            ))}
          </View>
        </View>
      )}

      <View className="gap-2">
        <Text className="font-mono text-xs uppercase text-content-muted">Add your own</Text>
        <View className="flex-row items-center gap-2">
          <Input
            value={draft}
            onChangeText={setDraft}
            placeholder="e.g. neo-traditional"
            returnKeyType="done"
            onSubmitEditing={commitDraft}
            className="flex-1"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add tag"
            onPress={commitDraft}
            className="h-11 w-11 items-center justify-center rounded-lg border border-border-subtle bg-surface-raised active:bg-surface-overlay"
          >
            <Icon name="plus" size={18} color={colors.text.primary} />
          </Pressable>
        </View>
        {customTags.length > 0 && (
          <View className="flex-row flex-wrap gap-2 pt-1">
            {customTags.map((tag) => (
              <Pressable
                key={tag}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${tag}`}
                onPress={() => onRemoveCustom(tag)}
                className="flex-row items-center gap-1 rounded-full border border-border-accent bg-surface-overlay px-3 py-1.5"
              >
                <Text className="text-sm text-content-primary">{tag}</Text>
                <Icon name="x" size={13} color={colors.text.muted} />
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}
