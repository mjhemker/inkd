"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Badge,
  Button,
  Card,
  Eyebrow,
  Icon,
  Modal,
  Skeleton,
  Tabs,
  TextArea,
  Input,
  EmptyState,
  Toggle,
  useToast,
} from "@inkd/ui/web";
import {
  useInkdClient,
  useCurrentProfile,
  useGlobalWaiverTemplates,
  useArtistWaiverTemplates,
  usePickGlobalWaiverTemplate,
  useUpdateWaiverTemplate,
  useSignedWaiversForArtist,
} from "@inkd/core/hooks";
import { getCurrentArtistProfile } from "@inkd/core/auth";
import type { WaiverTemplate, SignedWaiver, UsState } from "@inkd/core/types";
import {
  parseRequiredFields,
  renderWaiverBody,
  retentionLabel,
} from "@inkd/core/waivers";

type StateTab = "MD" | "PA" | "GENERIC";

const TABS: { value: StateTab; label: string; state: UsState | null }[] = [
  { value: "MD", label: "Maryland", state: "MD" },
  { value: "PA", label: "Pennsylvania", state: "PA" },
  { value: "GENERIC", label: "Generic fallback", state: null },
];

const PREVIEW_CTX = {
  artistName: "Your Name",
  studioName: "Your Studio",
  studioAddress: "123 Main St, Baltimore, MD",
  clientName: "Sample Client",
  procedureDescription: "black & grey forearm piece, ~3 hours",
  placement: "left forearm",
  sessionDate: "a scheduled session",
  date: new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }),
};

function useCurrentArtist() {
  const client = useInkdClient();
  const { data: profile } = useCurrentProfile();
  const query = useQuery({
    queryKey: ["currentArtistProfile", profile?.id ?? ""],
    queryFn: () => getCurrentArtistProfile(client),
    enabled: Boolean(profile?.id),
  });
  return query;
}

export function WaiverTemplateManager() {
  const { toast } = useToast();
  const { data: artistProfile, isLoading: artistLoading } = useCurrentArtist();
  const artistId = artistProfile?.id ?? "";

  const { data: globalTemplates, isLoading: globalLoading } =
    useGlobalWaiverTemplates();
  const { data: ownTemplates, isLoading: ownLoading } =
    useArtistWaiverTemplates(artistId);
  const { data: signedWaivers, isLoading: signedLoading } =
    useSignedWaiversForArtist(artistId);

  const pickTemplate = usePickGlobalWaiverTemplate(artistId);
  const updateTemplate = useUpdateWaiverTemplate(artistId);

  const [tab, setTab] = useState<StateTab>("MD");
  const [editing, setEditing] = useState<WaiverTemplate | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [previewTemplate, setPreviewTemplate] = useState<WaiverTemplate | null>(
    null,
  );
  const [viewingSigned, setViewingSigned] = useState<SignedWaiver | null>(null);

  const activeTab = TABS.find((t) => t.value === tab)!;
  const globalForTab = globalTemplates?.find((t) => t.state === activeTab.state);
  const ownForTab = ownTemplates?.find((t) => t.state === activeTab.state);

  const loading = artistLoading || globalLoading || ownLoading;

  function openEditor(template: WaiverTemplate) {
    setEditing(template);
    setEditTitle(template.title);
    setEditBody(template.body);
  }

  async function handlePick() {
    if (!globalForTab) return;
    try {
      await pickTemplate.mutateAsync(globalForTab.id);
      toast({
        title: "Template added",
        description: `You can now customize the ${activeTab.label} template.`,
        variant: "success",
      });
    } catch {
      toast({ title: "Couldn't add template", variant: "danger" });
    }
  }

  async function handleSaveEdit() {
    if (!editing) return;
    try {
      await updateTemplate.mutateAsync({
        id: editing.id,
        patch: { title: editTitle, body: editBody },
      });
      toast({ title: "Template saved", variant: "success" });
      setEditing(null);
    } catch {
      toast({ title: "Couldn't save template", variant: "danger" });
    }
  }

  async function handleToggleActive(template: WaiverTemplate) {
    try {
      await updateTemplate.mutateAsync({
        id: template.id,
        patch: { is_active: !template.is_active },
      });
    } catch {
      toast({ title: "Couldn't update template", variant: "danger" });
    }
  }

  const requiredPreviewFields = useMemo(
    () => (previewTemplate ? parseRequiredFields(previewTemplate) : []),
    [previewTemplate],
  );

  if (!artistLoading && !artistProfile) {
    return (
      <EmptyState
        icon={<Icon name="shield" size={26} />}
        title="Artist profile required"
        description="Waiver templates are managed per artist workspace. Finish onboarding to set one up."
      />
    );
  }

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4">
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as StateTab)}
          items={TABS.map((t) => ({ value: t.value, label: t.label }))}
        />

        {loading ? (
          <Skeleton className="h-56 w-full" />
        ) : ownForTab ? (
          <Card padding="lg" className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-sans text-base font-semibold text-content-primary">
                    {ownForTab.title}
                  </h3>
                  <Badge variant={ownForTab.is_active ? "success" : "neutral"}>
                    {ownForTab.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <p className="text-sm text-content-muted">
                  Customized from the INKD {activeTab.label} template &middot;
                  v{ownForTab.version}
                </p>
              </div>
              <Toggle
                checked={ownForTab.is_active}
                onCheckedChange={() => handleToggleActive(ownForTab)}
              />
            </div>
            <p className="line-clamp-3 text-sm text-content-secondary">
              {ownForTab.body.replace(/\*\*\*[^*]*\*\*\*/g, "").trim()}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => openEditor(ownForTab)}>
                Edit copy
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setPreviewTemplate(ownForTab)}
              >
                Preview
              </Button>
            </div>
          </Card>
        ) : globalForTab ? (
          <Card padding="lg" className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <h3 className="font-sans text-base font-semibold text-content-primary">
                  {globalForTab.title}
                </h3>
                <Badge variant="brand">INKD default</Badge>
              </div>
              <p className="text-sm text-content-muted">
                Not yet customized — clients will see this exact wording until
                you pick and edit it.
              </p>
            </div>
            <p className="line-clamp-3 text-sm text-content-secondary">
              {globalForTab.body.replace(/\*\*\*[^*]*\*\*\*/g, "").trim()}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={handlePick} loading={pickTemplate.isPending}>
                Use this template
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setPreviewTemplate(globalForTab)}
              >
                Preview
              </Button>
            </div>
          </Card>
        ) : (
          <EmptyState
            icon={<Icon name="shield" size={24} />}
            title="No template available"
            description="INKD hasn't published a template for this jurisdiction yet."
          />
        )}
      </section>

      <section className="flex flex-col gap-4">
        <Eyebrow>Signed waivers</Eyebrow>
        {signedLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : !signedWaivers || signedWaivers.length === 0 ? (
          <EmptyState
            icon={<Icon name="check" size={24} />}
            title="No signed waivers yet"
            description="Once a client signs, the immutable record shows up here."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {signedWaivers.map((w) => (
              <Card
                key={w.id}
                padding="md"
                className="flex flex-wrap items-center justify-between gap-3"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-content-primary">
                    {w.signer_name}
                  </span>
                  <span className="text-xs text-content-muted">
                    Signed {new Date(w.signed_at).toLocaleDateString()} &middot;
                    retain {retentionLabel(w.state)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{w.state}</Badge>
                  {w.signature_type === "drawn" && (
                    <Badge variant="neutral">Drawn signature</Badge>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setViewingSigned(w)}>
                    View
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Edit copy modal */}
      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Edit template copy"
        description="Changes apply to future signings only — waivers already signed are frozen and never change."
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} loading={updateTemplate.isPending}>
              Save
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-content-primary">
              Title
            </label>
            <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-content-primary">
              Body
            </label>
            <TextArea
              rows={16}
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              className="font-mono text-xs"
            />
            <p className="text-xs text-content-muted">
              Keep the {"{{token}}"} placeholders (artist_name, studio_name,
              studio_address, client_name, procedure_description, placement,
              session_date, date) — they&apos;re filled in automatically when
              a client signs.
            </p>
          </div>
        </div>
      </Modal>

      {/* Preview modal */}
      <Modal
        open={Boolean(previewTemplate)}
        onClose={() => setPreviewTemplate(null)}
        title={previewTemplate?.title}
        description="Preview with sample data — this is what a client sees before they sign."
        size="lg"
      >
        {previewTemplate && (
          <div className="flex flex-col gap-4">
            <div className="max-h-80 overflow-y-auto rounded-xl border border-border-subtle bg-surface-overlay p-4">
              <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-content-secondary">
                {renderWaiverBody(previewTemplate.body, PREVIEW_CTX)}
              </pre>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-content-muted">
                Checkboxes
              </span>
              {requiredPreviewFields.map((f) => (
                <div key={f.key} className="flex items-center gap-2 text-sm text-content-secondary">
                  <Icon name="check" size={14} className="text-content-accent" />
                  {f.label}
                  {!f.required && (
                    <Badge size="sm" variant="neutral">
                      Optional
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>

      {/* Signed waiver view modal */}
      <Modal
        open={Boolean(viewingSigned)}
        onClose={() => setViewingSigned(null)}
        title={viewingSigned ? `Signed by ${viewingSigned.signer_name}` : undefined}
        description={
          viewingSigned
            ? `Signed ${new Date(viewingSigned.signed_at).toLocaleString()} — immutable record`
            : undefined
        }
        size="lg"
      >
        {viewingSigned && (
          <div className="max-h-96 overflow-y-auto rounded-xl border border-border-subtle bg-surface-overlay p-4">
            <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-content-secondary">
              {viewingSigned.content_snapshot}
            </pre>
          </div>
        )}
      </Modal>
    </div>
  );
}
