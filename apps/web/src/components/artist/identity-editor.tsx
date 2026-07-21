"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Avatar,
  Badge,
  Button,
  Chip,
  FormField,
  Icon,
  Input,
  Spinner,
  TextArea,
  useToast,
} from "@inkd/ui/web";
import { isHandleAvailable, type ArtistProfile, type Profile } from "@inkd/core";
import {
  useInkdClient,
  useStyles,
  useUpdateArtistProfile,
  useUpdateProfile,
  useUploadMedia,
  usePortfolioPieces,
  usePortfolioMutations,
  useInstagramConnectionState,
  useInstagramStartOAuth,
} from "@inkd/core/hooks";
import { buildPiecesAddedMessage, type InstagramImportRunResult } from "@inkd/core";
import { useQueryClient } from "@tanstack/react-query";

import type { EditorHandle } from "./types";
import { InstagramImportModal } from "./instagram/InstagramImportModal";
import { InstagramGlyph } from "./instagram/glyphs";

type HandleState = "idle" | "checking" | "available" | "taken" | "invalid";

/** Normalize free-text into a slug-like token stored alongside taxonomy slugs. */
function slugifyStyle(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** Prettify a slug (taxonomy or custom) for display, e.g. "neo-traditional". */
function prettifyStyle(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export interface IdentityEditorProps {
  profile: Profile;
  artist: ArtistProfile;
  variant?: "onboarding" | "settings";
}

export const IdentityEditor = forwardRef<EditorHandle, IdentityEditorProps>(
  function IdentityEditor({ profile, artist, variant = "onboarding" }, ref) {
    const { toast } = useToast();
    const client = useInkdClient();
    const updateProfile = useUpdateProfile(profile.id);
    const updateArtist = useUpdateArtistProfile(artist.id);
    const uploadMedia = useUploadMedia(profile.id);
    const { data: styles } = useStyles();
    const { data: pieces } = usePortfolioPieces(artist.id);
    const { create: createPiece, remove: deletePiece } =
      usePortfolioMutations(artist.id);

    const [displayName, setDisplayName] = useState(profile.display_name ?? "");
    const [handle, setHandle] = useState(profile.handle ?? "");
    const [bio, setBio] = useState(artist.bio ?? profile.bio ?? "");
    const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? "");
    // Local object URL for the file the user just picked — shown immediately
    // so the avatar never regresses to the (enlarged, at this size) initials
    // fallback while the upload is in flight. Cleared once the real
    // `avatarUrl` (the uploaded public URL) takes over.
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [selectedStyles, setSelectedStyles] = useState<string[]>(
      artist.styles ?? [],
    );
    const [handleState, setHandleState] = useState<HandleState>("idle");
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [portfolioBusy, setPortfolioBusy] = useState(false);

    const avatarInput = useRef<HTMLInputElement>(null);
    const portfolioInput = useRef<HTMLInputElement>(null);
    const originalHandle = useMemo(
      () => (profile.handle ?? "").toLowerCase(),
      [profile.handle],
    );

    // Debounced handle availability check.
    useEffect(() => {
      const trimmed = handle.trim();
      if (trimmed.toLowerCase() === originalHandle && trimmed !== "") {
        setHandleState("idle");
        return;
      }
      if (trimmed === "") {
        setHandleState("idle");
        return;
      }
      if (!/^[a-z0-9._]{2,30}$/i.test(trimmed)) {
        setHandleState("invalid");
        return;
      }
      setHandleState("checking");
      const t = setTimeout(async () => {
        try {
          const free = await isHandleAvailable(client, trimmed);
          setHandleState(free ? "available" : "taken");
        } catch {
          setHandleState("idle");
        }
      }, 400);
      return () => clearTimeout(t);
    }, [handle, originalHandle, client]);

    async function handleAvatarFile(file: File) {
      // Show the picked file immediately via a local object URL — the actual
      // upload + public-URL round trip happens in the background below.
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);
      setUploadingAvatar(true);
      try {
        const { publicUrl } = await uploadMedia.mutateAsync({
          folder: "avatars",
          file: { data: file, name: file.name, contentType: file.type },
        });
        setAvatarUrl(publicUrl);
        await updateProfile.mutateAsync({ avatar_url: publicUrl });
        toast({ title: "Avatar updated", variant: "success" });
      } catch (err) {
        toast({
          title: "Upload failed",
          description: err instanceof Error ? err.message : "Try another image.",
          variant: "danger",
        });
      } finally {
        setUploadingAvatar(false);
        URL.revokeObjectURL(objectUrl);
        setPreviewUrl(null);
      }
    }

    async function handlePortfolioFiles(files: FileList) {
      setPortfolioBusy(true);
      try {
        for (const file of Array.from(files)) {
          const { publicUrl } = await uploadMedia.mutateAsync({
            folder: "portfolio",
            file: { data: file, name: file.name, contentType: file.type },
          });
          await createPiece.mutateAsync({ image_url: publicUrl, is_public: true });
        }
        toast({ title: "Portfolio updated", variant: "success" });
      } catch (err) {
        toast({
          title: "Upload failed",
          description: err instanceof Error ? err.message : "Try again.",
          variant: "danger",
        });
      } finally {
        setPortfolioBusy(false);
      }
    }

    async function save(): Promise<boolean> {
      if (!displayName.trim()) {
        toast({ title: "Add your name to continue", variant: "danger" });
        return false;
      }
      if (!handle.trim() || handleState === "taken" || handleState === "invalid") {
        toast({ title: "Pick an available handle", variant: "danger" });
        return false;
      }
      try {
        await updateProfile.mutateAsync({
          display_name: displayName.trim(),
          handle: handle.trim(),
          bio: bio.trim() || null,
        });
        await updateArtist.mutateAsync({
          bio: bio.trim() || null,
          styles: selectedStyles,
        });
        return true;
      } catch (err) {
        toast({
          title: "Couldn't save",
          description: err instanceof Error ? err.message : "Try again.",
          variant: "danger",
        });
        return false;
      }
    }

    useImperativeHandle(ref, () => ({ save }));

    const saving = updateProfile.isPending || updateArtist.isPending;

    function toggleStyle(slug: string) {
      setSelectedStyles((prev) =>
        prev.includes(slug)
          ? prev.filter((s) => s !== slug)
          : prev.length >= 8
            ? prev
            : [...prev, slug],
      );
    }

    // Custom ("add your own") styles: free text a taxonomy chip can't cover.
    // They persist in the same artist_profiles.styles text[] as taxonomy slugs
    // (no FK, no migration) — see updateArtistProfile.
    const taxonomySlugs = useMemo(
      () => new Set((styles ?? []).map((s) => s.slug)),
      [styles],
    );
    const customStyles = selectedStyles.filter((s) => !taxonomySlugs.has(s));
    const [customOpen, setCustomOpen] = useState(false);
    const [customInput, setCustomInput] = useState("");

    function addCustomStyle() {
      const slug = slugifyStyle(customInput);
      setCustomInput("");
      if (!slug) return;
      setSelectedStyles((prev) =>
        prev.includes(slug) || prev.length >= 8 ? prev : [...prev, slug],
      );
    }

    return (
      <div className="flex flex-col gap-7">
        {/* Avatar + name */}
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="relative">
            <Avatar
              src={previewUrl ?? (avatarUrl || undefined)}
              name={displayName || "You"}
              size="xl"
            />
            <button
              type="button"
              onClick={() => avatarInput.current?.click()}
              className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full border border-border-strong bg-surface-overlay text-content-primary outline-none transition-colors hover:bg-surface-raised focus-visible:ring-2 focus-visible:ring-brand"
              aria-label="Upload avatar"
            >
              {uploadingAvatar ? <Spinner size={14} /> : <Icon name="image" size={15} />}
            </button>
            <input
              ref={avatarInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleAvatarFile(f);
                e.target.value = "";
              }}
            />
          </div>
          <div className="flex-1">
            <FormField label="Display name" htmlFor="id-name" required>
              <Input
                id="id-name"
                placeholder="Your name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                leadingIcon={<Icon name="user" size={16} />}
              />
            </FormField>
          </div>
        </div>

        {/* Handle */}
        <FormField
          label="Handle"
          htmlFor="id-handle"
          required
          description="Your public @ on INKD."
          error={
            handleState === "invalid"
              ? "Use 2–30 letters, numbers, dots or underscores."
              : handleState === "taken"
                ? "That handle is taken."
                : undefined
          }
        >
          <Input
            id="id-handle"
            placeholder="yourhandle"
            value={handle}
            invalid={handleState === "taken" || handleState === "invalid"}
            onChange={(e) => setHandle(e.target.value.replace(/\s/g, ""))}
            leadingIcon={<span className="font-mono text-sm text-content-muted">@</span>}
            trailingIcon={
              handleState === "checking" ? (
                <Spinner size={14} />
              ) : handleState === "available" ? (
                <Icon name="check" size={16} />
              ) : undefined
            }
          />
        </FormField>
        {handleState === "available" && (
          <p className="-mt-4 text-sm text-content-accent">
            @{handle.trim()} is available.
          </p>
        )}

        {/* Bio */}
        <FormField
          label="Bio"
          htmlFor="id-bio"
          description="A line or two clients read first."
        >
          <TextArea
            id="id-bio"
            rows={3}
            placeholder="Baltimore-based, blackwork & fine line. Booking custom pieces and touch-ups."
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
        </FormField>

        {/* Styles */}
        {styles && styles.length > 0 && (
          <div className="flex flex-col gap-2.5">
            <span className="text-sm font-medium text-content-primary">
              Styles you work in
            </span>
            <div className="flex flex-wrap gap-2">
              {styles.map((s) => (
                <Chip
                  key={s.id}
                  selected={selectedStyles.includes(s.slug)}
                  onClick={() => toggleStyle(s.slug)}
                >
                  {s.name}
                </Chip>
              ))}
              {/* Custom styles the artist added themselves. */}
              {customStyles.map((slug) => (
                <Chip key={`custom:${slug}`} selected onClick={() => toggleStyle(slug)}>
                  {prettifyStyle(slug)}
                </Chip>
              ))}
              {!customOpen && (
                <button
                  type="button"
                  onClick={() => setCustomOpen(true)}
                  className="inline-flex items-center gap-1 rounded-sm border border-dashed border-border-strong px-2.5 py-1 text-xs font-medium text-content-secondary outline-none transition-colors hover:border-brand hover:text-content-primary focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <Icon name="plus" size={13} /> Add your own
                </button>
              )}
            </div>
            {customOpen && (
              <div className="flex items-center gap-2">
                <Input
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCustomStyle();
                    }
                  }}
                  placeholder="e.g. Chicano, dotwork…"
                  aria-label="Add a custom style"
                  autoFocus
                  className="max-w-56"
                />
                <Button type="button" size="sm" variant="outline" onClick={addCustomStyle}>
                  Add
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    setCustomOpen(false);
                    setCustomInput("");
                  }}
                  aria-label="Cancel"
                  className="grid h-8 w-8 place-items-center rounded-lg text-content-muted outline-none hover:bg-surface-overlay hover:text-content-primary focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <Icon name="x" size={15} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Portfolio */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-content-primary">
              Portfolio
              {pieces && pieces.length > 0 && (
                <span className="ml-2 font-mono text-xs text-content-muted">
                  {pieces.length} {pieces.length === 1 ? "piece" : "pieces"}
                </span>
              )}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
            {pieces?.map((p) => (
              <div
                key={p.id}
                className="group relative aspect-square overflow-hidden rounded-xl border border-border-subtle bg-surface-overlay"
              >
                {p.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.image_url}
                    alt={p.title ?? "Portfolio piece"}
                    className="h-full w-full object-cover"
                  />
                ) : null}
                <button
                  type="button"
                  onClick={() => deletePiece.mutate(p.id)}
                  className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-surface-base/80 text-content-secondary opacity-0 outline-none transition-opacity hover:text-danger-500 focus-visible:opacity-100 group-hover:opacity-100"
                  aria-label="Remove piece"
                >
                  <Icon name="x" size={13} />
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={() => portfolioInput.current?.click()}
              className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border-strong bg-surface-raised/40 text-content-muted outline-none transition-colors hover:border-border-accent hover:text-content-secondary focus-visible:ring-2 focus-visible:ring-brand"
            >
              {portfolioBusy ? (
                <Spinner size={18} />
              ) : (
                <>
                  <Icon name="plus" size={18} />
                  <span className="text-[11px] font-medium">Add images</span>
                </>
              )}
            </button>
          </div>
          <input
            ref={portfolioInput}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) void handlePortfolioFiles(e.target.files);
              e.target.value = "";
            }}
          />

          <InstagramImportRow artistId={artist.id} variant={variant} />
        </div>

        {variant === "settings" && (
          <div className="flex justify-end">
            <Button onClick={() => void save()} loading={saving}>
              Save changes
            </Button>
          </div>
        )}
      </div>
    );
  },
);

/**
 * The portfolio section's "Import your work from Instagram" card — shared by
 * onboarding (§3.A) + settings identity. State is ALWAYS re-derived from the
 * server (`instagram-status`), so the affordance is never out of sync:
 * "Coming soon" only shows on a 503; once live it's a real Connect / Import
 * control that opens the selection picker.
 *
 * On connect we set a client-side "resume" flag before the full-page OAuth
 * redirect (belt-and-suspenders alongside the server `return_to`), so that on
 * return we can auto-open the picker.
 */
const IG_RESUME_KEY = "inkd:ig:resume-import";

function InstagramImportRow({
  artistId,
  variant,
}: {
  artistId: string;
  variant: "onboarding" | "settings";
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { state } = useInstagramConnectionState(artistId);
  const startOAuth = useInstagramStartOAuth();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [addedMessage, setAddedMessage] = useState<string | null>(null);

  const returnTo = variant === "onboarding" ? "/onboarding" : "/studio/settings";

  // Resume after the OAuth round-trip: if we flagged a connect and we're now
  // connected, auto-open the picker once.
  useEffect(() => {
    if (state.kind !== "connected") return;
    if (typeof window === "undefined") return;
    if (window.sessionStorage.getItem(IG_RESUME_KEY)) {
      window.sessionStorage.removeItem(IG_RESUME_KEY);
      setPickerOpen(true);
    }
  }, [state.kind]);

  async function connect() {
    try {
      if (typeof window !== "undefined") window.sessionStorage.setItem(IG_RESUME_KEY, "1");
      // Mint a FRESH url every tap; full-page redirect (never a popup).
      const { url } = await startOAuth.mutateAsync({ return_to: returnTo });
      window.location.href = url;
    } catch (err) {
      if (typeof window !== "undefined") window.sessionStorage.removeItem(IG_RESUME_KEY);
      toast({
        title: "Couldn't start Instagram connect",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "danger",
      });
    }
  }

  function onImported(run: InstagramImportRunResult) {
    if (run.pieces_created > 0) {
      setAddedMessage(buildPiecesAddedMessage(run));
      // Refresh the portfolio grid so imported pieces appear immediately.
      qc.invalidateQueries({ queryKey: ["portfolioPieces", artistId] });
    }
  }

  const connected = state.kind === "connected";
  const comingSoon = state.kind === "comingSoon";
  const tokenExpired = state.kind === "tokenExpired";

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border-subtle bg-surface-raised/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-sm bg-surface-ember text-brand-on-ember">
            <InstagramGlyph size={17} />
          </span>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-content-primary">
              Import your work from Instagram
            </span>
            <span className="text-xs text-content-muted">
              {connected && state.username
                ? `Connected as @${state.username}`
                : "Bring your posts in as portfolio pieces — you pick which ones."}
            </span>
          </div>
        </div>
        {comingSoon ? (
          <Badge variant="outline">Coming soon</Badge>
        ) : connected ? (
          <Button size="sm" variant="outline" onClick={() => setPickerOpen(true)}>
            Import posts
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => void connect()}
            loading={startOAuth.isPending}
          >
            {tokenExpired ? "Reconnect" : "Connect"}
          </Button>
        )}
      </div>

      {!connected && !comingSoon && (
        <p className="text-[11px] leading-relaxed text-content-muted">
          Requires an Instagram Business or Creator account — free to switch in Instagram →
          Settings → Account type.
        </p>
      )}

      {addedMessage && (
        <p className="flex items-center gap-1.5 text-xs font-medium text-content-ember">
          <Icon name="check" size={13} />
          {addedMessage}
        </p>
      )}

      {connected && (
        <InstagramImportModal
          artistId={artistId}
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onImported={onImported}
          portfolioHref={variant === "onboarding" ? undefined : "/profile"}
        />
      )}
    </div>
  );
}
