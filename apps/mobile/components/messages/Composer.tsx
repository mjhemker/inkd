import { useState } from "react";
import { ActivityIndicator, Image, Pressable, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useMutation } from "@tanstack/react-query";
import { Button, Icon, TextArea, cx, useToast } from "@inkd/ui/native";
import { uploadChatAttachment, useInkdClient, type ChatAttachment } from "@inkd/core";
import { useTheme } from "@/providers/theme";

const MAX_ATTACHMENTS = 4;

interface PendingAttachment {
  id: string;
  previewUri: string;
  /** Retained so a failed upload can be retried from the same source asset. */
  filename: string;
  contentType: string;
  status: "uploading" | "done" | "error";
  result?: ChatAttachment;
  error?: string;
}

/**
 * Message composer: text + up to `MAX_ATTACHMENTS` image attachments, picked
 * via `expo-image-picker`. Native uploads go up as-picked (no client-side
 * resize — Expo's picker `quality` already downsamples reasonably); each
 * picked image uploads immediately into the thread's
 * `chat/{thread_id}/{sender_id}/...` folder, so "Send" only attaches
 * already-uploaded paths.
 */
export function Composer({
  threadId,
  senderId,
  onSend,
  disabled,
}: {
  threadId: string;
  senderId: string | undefined;
  onSend: (body: string, attachments: ChatAttachment[]) => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  const [value, setValue] = useState("");
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const client = useInkdClient();
  const { toast } = useToast();

  const upload = useMutation({
    mutationFn: (args: { file: Blob; filename: string; contentType?: string }) =>
      uploadChatAttachment(client, {
        threadId,
        senderId: senderId as string,
        file: args.file,
        filename: args.filename,
        contentType: args.contentType,
      }),
  });

  const isUploading = pending.some((p) => p.status === "uploading");
  const readyAttachments = pending
    .filter((p): p is PendingAttachment & { result: ChatAttachment } => p.status === "done" && Boolean(p.result))
    .map((p) => p.result);
  const canPickMore = pending.length < MAX_ATTACHMENTS;
  const canSend =
    !disabled && !isUploading && (value.trim().length > 0 || readyAttachments.length > 0);

  async function pickImages() {
    if (!senderId) return;
    const room = MAX_ATTACHMENTS - pending.length;
    if (room <= 0) {
      toast({ title: `You can attach up to ${MAX_ATTACHMENTS} photos`, variant: "info" });
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      toast({ title: "Photo access is off — enable it in Settings to attach photos.", variant: "danger" });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
      allowsMultipleSelection: room > 1,
      selectionLimit: room,
    });
    if (result.canceled) return;

    for (const asset of result.assets.slice(0, room)) {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const filename = asset.fileName ?? `photo-${Date.now()}.jpg`;
      const contentType = asset.mimeType ?? "image/jpeg";
      setPending((prev) => [
        ...prev,
        { id, previewUri: asset.uri, filename, contentType, status: "uploading" },
      ]);
      await runUpload(id, asset.uri, filename, contentType);
    }
  }

  async function runUpload(id: string, uri: string, filename: string, contentType: string) {
    setPending((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: "uploading", error: undefined } : p)),
    );
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const uploaded = await upload.mutateAsync({ file: blob, filename, contentType });
      setPending((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status: "done", result: uploaded } : p)),
      );
    } catch (err) {
      setPending((prev) =>
        prev.map((p) =>
          p.id === id
            ? { ...p, status: "error", error: err instanceof Error ? err.message : "Upload failed" }
            : p,
        ),
      );
    }
  }

  /** Re-attempt a failed upload from its original source asset, in place. */
  function retryPending(id: string) {
    const target = pending.find((p) => p.id === id);
    if (target) void runUpload(id, target.previewUri, target.filename, target.contentType);
  }

  function removePending(id: string) {
    setPending((prev) => prev.filter((p) => p.id !== id));
  }

  function submit() {
    if (!canSend) return;
    const trimmed = value.trim();
    onSend(trimmed, readyAttachments);
    setValue("");
    setPending([]);
  }

  return (
    <View className="gap-2 border-t border-border-subtle bg-surface-base px-4 py-3">
      {pending.length > 0 && (
        <View className="flex-row flex-wrap gap-2">
          {pending.map((p) => (
            <View
              key={p.id}
              className="relative h-16 w-16 overflow-hidden rounded-lg border border-border-subtle bg-surface-overlay"
            >
              <Image source={{ uri: p.previewUri }} className="h-full w-full" resizeMode="cover" />
              {p.status === "uploading" && (
                <View className="absolute inset-0 items-center justify-center gap-0.5 bg-black/50">
                  <ActivityIndicator size="small" color="#FAFAFA" />
                  <Text className="font-mono text-[8px] uppercase tracking-wide text-white/90">
                    Sending
                  </Text>
                </View>
              )}
              {p.status === "done" && (
                <View
                  className="absolute bottom-0.5 left-0.5 h-4 w-4 items-center justify-center rounded-full bg-success-500"
                  accessibilityLabel="Attached"
                >
                  <Icon name="check" size={11} color="#FAFAFA" />
                </View>
              )}
              {p.status === "error" && (
                <Pressable
                  onPress={() => retryPending(p.id)}
                  accessibilityRole="button"
                  accessibilityLabel="Upload failed — tap to retry"
                  className="absolute inset-0 items-center justify-center gap-0.5 bg-danger-500/75"
                >
                  <Icon name="alert-triangle" size={14} color="#FAFAFA" />
                  <Text className="font-mono text-[8px] font-semibold uppercase tracking-wide text-white">
                    Retry
                  </Text>
                </Pressable>
              )}
              <Pressable
                onPress={() => removePending(p.id)}
                accessibilityRole="button"
                accessibilityLabel="Remove attachment"
                className="absolute right-0.5 top-0.5 h-5 w-5 items-center justify-center rounded-full bg-black/70"
              >
                <Icon name="x" size={11} color="#FAFAFA" />
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <View className="flex-row items-end gap-2">
        <Pressable
          disabled={disabled || !senderId || !canPickMore}
          onPress={pickImages}
          accessibilityRole="button"
          accessibilityLabel="Attach a photo"
          className={cx(
            "h-10 w-10 items-center justify-center rounded-lg",
            (disabled || !senderId || !canPickMore) && "opacity-40",
          )}
        >
          <Icon name="image" size={20} color={colors.text.muted} />
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
          disabled={!canSend}
          onPress={submit}
          accessibilityLabel="Send message"
        >
          <Icon name="arrow-right" size={16} color="#FAFAFA" />
        </Button>
      </View>
    </View>
  );
}
