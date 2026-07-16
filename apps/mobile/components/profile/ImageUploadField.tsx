import { useState } from "react";
import { ActivityIndicator, Image, Pressable, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Icon, cx } from "@inkd/ui/native";
import { useUploadMedia, type MediaFolder } from "@inkd/core";
import { useTheme } from "@/providers/theme";

/** File-picker tile that uploads straight to the `media` bucket and reports
 * back the public URL, mirroring apps/web's ImageUploadField. */
export function ImageUploadField({
  userId,
  folder,
  value,
  onChange,
  aspect = "square",
  label = "Add image",
  className,
}: {
  userId: string;
  folder: MediaFolder;
  value?: string | null;
  onChange: (url: string) => void;
  aspect?: "square" | "wide";
  label?: string;
  className?: string;
}) {
  const { colors } = useTheme();
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const upload = useUploadMedia(userId);

  async function pickImage() {
    setError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Photo access is off — enable it in Settings to upload.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
      allowsEditing: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset) return;

    setPreviewUri(asset.uri);
    try {
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const fileName = asset.fileName ?? `photo-${Date.now()}.jpg`;
      const contentType = asset.mimeType ?? "image/jpeg";
      const uploaded = await upload.mutateAsync({
        folder,
        file: { data: blob, name: fileName, contentType },
      });
      onChange(uploaded.publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Try again.");
    }
  }

  const shown = previewUri ?? value ?? null;

  return (
    <View className={cx("gap-2", className)}>
      <Pressable
        accessibilityRole="button"
        onPress={pickImage}
        className={cx(
          "items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-surface-overlay",
          aspect === "square" ? "aspect-square" : "aspect-[16/10]",
        )}
      >
        {shown ? (
          <Image source={{ uri: shown }} className="h-full w-full" resizeMode="cover" />
        ) : (
          <View className="items-center gap-2 p-6">
            <Icon name="image" size={22} color={colors.text.muted} />
            <Text className="text-center text-sm text-content-muted">{label}</Text>
          </View>
        )}
        {upload.isPending && (
          <View className="absolute inset-0 items-center justify-center bg-black/50">
            <ActivityIndicator color="#FAFAFA" />
          </View>
        )}
      </Pressable>
      {error && <Text className="text-sm text-danger-500">{error}</Text>}
    </View>
  );
}
