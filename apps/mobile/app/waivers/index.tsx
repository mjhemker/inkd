/**
 * Artist-facing waiver template management (mobile equivalent of the web
 * /settings/waivers page). Standalone top-level route (/waivers) rather than
 * nested under settings.tsx — that file is a single screen owned by the
 * settings-tabs agent, and expo-router file/folder collocation for a
 * settings.tsx + settings/ directory is ambiguous, so this stays separate.
 */
import { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  Icon,
  Modal,
  Skeleton,
  Tabs,
  TextArea,
  Input,
  Toggle,
  ToastProvider,
  useToast,
} from "@inkd/ui/native";
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

import { ScreenHeader } from "@/components/ScreenHeader";

type StateTab = "MD" | "PA" | "GENERIC";

const TABS: { value: StateTab; label: string; state: UsState | null }[] = [
  { value: "MD", label: "Maryland", state: "MD" },
  { value: "PA", label: "Pennsylvania", state: "PA" },
  { value: "GENERIC", label: "Generic", state: null },
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
  return useQuery({
    queryKey: ["currentArtistProfile", profile?.id ?? ""],
    queryFn: () => getCurrentArtistProfile(client),
    enabled: Boolean(profile?.id),
  });
}

export default function WaiversScreen() {
  return (
    <ToastProvider>
      <WaiversScreenBody />
    </ToastProvider>
  );
}

function WaiversScreenBody() {
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

  const requiredPreviewFields = useMemo(
    () => (previewTemplate ? parseRequiredFields(previewTemplate) : []),
    [previewTemplate],
  );

  function openEditor(template: WaiverTemplate) {
    setEditing(template);
    setEditTitle(template.title);
    setEditBody(template.body);
  }

  async function handlePick() {
    if (!globalForTab) return;
    try {
      await pickTemplate.mutateAsync(globalForTab.id);
      toast({ title: "Template added", variant: "success" });
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

  if (!artistLoading && !artistProfile) {
    return (
      <SafeAreaView className="flex-1 bg-surface-base" edges={["top", "bottom"]}>
        <View className="flex-1 px-6 py-8">
          <EmptyState
            icon={<Icon name="shield" size={32} color="#71717A" />}
            title="Artist profile required"
            description="Waiver templates are managed per artist workspace. Finish onboarding to set one up."
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-base" edges={["top", "bottom"]}>
      <ScrollView className="flex-1" contentContainerClassName="gap-8 px-6 py-8">
        <ScreenHeader
          eyebrow="SETTINGS · WAIVERS"
          title="Waivers & consent"
          subtitle="Pick and customize your state consent forms, then track every signed record."
        />

        <View className="gap-4">
          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as StateTab)}
            items={TABS.map((t) => ({ value: t.value, label: t.label }))}
          />

          {loading ? (
            <Skeleton className="h-48 w-full" />
          ) : ownForTab ? (
            <Card padding="lg">
              <CardContent className="gap-4">
                <View className="flex-row items-start justify-between gap-3">
                  <View className="flex-1 gap-1">
                    <View className="flex-row items-center gap-2">
                      <Text className="font-sans-medium text-base text-content-primary">
                        {ownForTab.title}
                      </Text>
                      <Badge variant={ownForTab.is_active ? "success" : "neutral"}>
                        {ownForTab.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </View>
                    <Text className="text-xs text-content-muted">
                      Customized · v{ownForTab.version}
                    </Text>
                  </View>
                  <Toggle
                    checked={ownForTab.is_active}
                    onCheckedChange={() => handleToggleActive(ownForTab)}
                  />
                </View>
                <Text className="text-sm text-content-secondary" numberOfLines={3}>
                  {ownForTab.body.replace(/\*\*\*[^*]*\*\*\*/g, "").trim()}
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onPress={() => openEditor(ownForTab)}>
                    Edit copy
                  </Button>
                  <Button size="sm" variant="ghost" onPress={() => setPreviewTemplate(ownForTab)}>
                    Preview
                  </Button>
                </View>
              </CardContent>
            </Card>
          ) : globalForTab ? (
            <Card padding="lg">
              <CardContent className="gap-4">
                <View className="gap-1">
                  <View className="flex-row items-center gap-2">
                    <Text className="font-sans-medium text-base text-content-primary">
                      {globalForTab.title}
                    </Text>
                    <Badge variant="brand">INKD default</Badge>
                  </View>
                  <Text className="text-xs text-content-muted">
                    Not yet customized.
                  </Text>
                </View>
                <Text className="text-sm text-content-secondary" numberOfLines={3}>
                  {globalForTab.body.replace(/\*\*\*[^*]*\*\*\*/g, "").trim()}
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  <Button size="sm" onPress={handlePick} loading={pickTemplate.isPending}>
                    Use this template
                  </Button>
                  <Button size="sm" variant="ghost" onPress={() => setPreviewTemplate(globalForTab)}>
                    Preview
                  </Button>
                </View>
              </CardContent>
            </Card>
          ) : (
            <EmptyState
              icon={<Icon name="shield" size={24} color="#71717A" />}
              title="No template available"
              description="INKD hasn't published a template for this jurisdiction yet."
            />
          )}
        </View>

        <View className="gap-4">
          <Text className="font-mono text-xs uppercase tracking-widest text-content-muted">
            Signed waivers
          </Text>
          {signedLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : !signedWaivers || signedWaivers.length === 0 ? (
            <EmptyState
              icon={<Icon name="check" size={24} color="#71717A" />}
              title="No signed waivers yet"
              description="Once a client signs, the immutable record shows up here."
            />
          ) : (
            <View className="gap-2">
              {signedWaivers.map((w) => (
                <Card key={w.id} padding="md">
                  <View className="flex-row items-center justify-between gap-3">
                    <View className="flex-1 gap-0.5">
                      <Text className="font-sans-medium text-sm text-content-primary">
                        {w.signer_name}
                      </Text>
                      <Text className="text-xs text-content-muted">
                        Signed {new Date(w.signed_at).toLocaleDateString()} · retain{" "}
                        {retentionLabel(w.state)}
                      </Text>
                    </View>
                    <Badge variant="outline">{w.state}</Badge>
                    <Button size="sm" variant="ghost" onPress={() => setViewingSigned(w)}>
                      View
                    </Button>
                  </View>
                </Card>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Edit template copy"
        description="Changes apply to future signings only — signed waivers are frozen."
        footer={
          <View className="flex-row justify-end gap-2">
            <Button variant="ghost" onPress={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onPress={handleSaveEdit} loading={updateTemplate.isPending}>
              Save
            </Button>
          </View>
        }
      >
        <View className="gap-3">
          <Input value={editTitle} onChangeText={setEditTitle} />
          <TextArea
            value={editBody}
            onChangeText={setEditBody}
            numberOfLines={10}
            className="text-xs"
          />
        </View>
      </Modal>

      <Modal
        open={Boolean(previewTemplate)}
        onClose={() => setPreviewTemplate(null)}
        title={previewTemplate?.title}
        description="Preview with sample data."
      >
        {previewTemplate && (
          <ScrollView className="max-h-72">
            <Text className="text-xs leading-relaxed text-content-secondary">
              {renderWaiverBody(previewTemplate.body, PREVIEW_CTX)}
            </Text>
            <View className="mt-3 gap-2">
              {requiredPreviewFields.map((f) => (
                <Text key={f.key} className="text-xs text-content-secondary">
                  {"✓"} {f.label}
                  {!f.required ? " (optional)" : ""}
                </Text>
              ))}
            </View>
          </ScrollView>
        )}
      </Modal>

      <Modal
        open={Boolean(viewingSigned)}
        onClose={() => setViewingSigned(null)}
        title={viewingSigned ? `Signed by ${viewingSigned.signer_name}` : undefined}
        description={
          viewingSigned
            ? `Signed ${new Date(viewingSigned.signed_at).toLocaleString()} — immutable`
            : undefined
        }
      >
        {viewingSigned && (
          <ScrollView className="max-h-72">
            <Text className="text-xs leading-relaxed text-content-secondary">
              {viewingSigned.content_snapshot}
            </Text>
          </ScrollView>
        )}
      </Modal>
    </SafeAreaView>
  );
}
