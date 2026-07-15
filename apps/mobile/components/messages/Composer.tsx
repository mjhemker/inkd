import { useState } from "react";
import { Pressable, View } from "react-native";
import { Button, Icon, TextArea } from "@inkd/ui/native";

/**
 * Message composer. Attachments are gated off for now and shipped text-first,
 * with the affordance visibly disabled rather than silently missing.
 * // TODO(media-bucket): the `media` bucket now exists, but chat image
 * attachments are still blocked on storage RLS — the media bucket only grants
 * public read on `avatar`/`portfolio` path segments and owner-only read
 * elsewhere, so the *other* thread participant cannot read a sender's uploaded
 * attachment. Enabling this needs a new storage policy granting thread
 * participants read access to attachment objects, plus attachment rendering in
 * the message bubble, before wiring this button to upload + pass the path
 * through `sendMessage`'s `attachments` field.
 */
export function Composer({
  onSend,
  disabled,
}: {
  onSend: (body: string) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState("");

  function submit() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  }

  return (
    <View className="flex-row items-end gap-2 border-t border-border-subtle bg-surface-base px-4 py-3">
      <Pressable
        disabled
        accessibilityRole="button"
        accessibilityLabel="Attach a photo (coming soon)"
        className="h-10 w-10 items-center justify-center rounded-lg opacity-40"
      >
        <Icon name="image" size={20} color="#71717A" />
      </Pressable>
      <TextArea
        value={value}
        onChangeText={setValue}
        placeholder="Write a message…"
        numberOfLines={1}
        className="max-h-28 min-h-[40px] flex-1 py-2.5"
      />
      <Button
        size="md"
        disabled={disabled || value.trim().length === 0}
        onPress={submit}
        accessibilityLabel="Send message"
      >
        <Icon name="arrow-right" size={16} color="#FAFAFA" />
      </Button>
    </View>
  );
}
