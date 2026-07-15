/** Inline artist-response editor shown under a review on booking detail
 * (native). Mirrors apps/web/src/components/reviews/artist-response-form.tsx. */
import { useState } from "react";
import { Text, View } from "react-native";
import { Button, TextArea } from "@inkd/ui/native";

export function ArtistResponseForm({
  initialResponse,
  onSubmit,
  submitting = false,
}: {
  initialResponse?: string | null;
  onSubmit: (response: string) => void | Promise<void>;
  submitting?: boolean;
}) {
  const [value, setValue] = useState(initialResponse ?? "");
  const hasExisting = Boolean(initialResponse?.trim());

  return (
    <View className="gap-2 border-t border-border-subtle pt-3">
      <Text className="font-mono text-[10px] uppercase tracking-widest text-content-muted">
        {hasExisting ? "Edit your response" : "Respond to this review"}
      </Text>
      <TextArea
        value={value}
        onChangeText={setValue}
        placeholder="Thank the client, add context, or clear anything up — this shows publicly under their review."
        maxLength={4000}
      />
      <Button
        size="sm"
        variant="secondary"
        className="self-end"
        disabled={!value.trim() || submitting}
        loading={submitting}
        onPress={() => onSubmit(value.trim())}
      >
        {hasExisting ? "Update response" : "Post response"}
      </Button>
    </View>
  );
}
