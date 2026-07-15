"use client";

import { useRef, useState } from "react";
import { Icon, Spinner, cx } from "@inkd/ui/web";
import { useUploadMedia, type MediaFolder } from "@inkd/core";

/**
 * File-picker tile that uploads straight to the `media` bucket and reports
 * back the public URL. Shows a local object-URL preview immediately so the
 * upload never feels like it stalled the form.
 */
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
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const upload = useUploadMedia(userId);

  async function handleFile(file: File) {
    setError(null);
    setPreviewUrl(URL.createObjectURL(file));
    try {
      const result = await upload.mutateAsync({
        folder,
        file: { data: file, name: file.name, contentType: file.type },
      });
      onChange(result.publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Try again.");
    }
  }

  const shown = previewUrl ?? value ?? null;

  return (
    <div className={cx("flex flex-col gap-2", className)}>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={cx(
          "group relative flex w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-surface-overlay text-content-muted transition-colors hover:border-border-accent",
          aspect === "square" ? "aspect-square" : "aspect-[16/10]",
        )}
      >
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-2 p-6 text-center text-sm">
            <Icon name="image" size={22} />
            {label}
          </span>
        )}
        {upload.isPending && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-content-primary">
            <Spinner size={22} />
          </span>
        )}
        {shown && !upload.isPending && (
          <span className="absolute bottom-2 right-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-content-primary opacity-0 transition-opacity group-hover:opacity-100">
            <Icon name="plus" size={16} />
          </span>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
          event.target.value = "";
        }}
      />
      {error && <p className="text-sm text-danger-500">{error}</p>}
    </div>
  );
}
