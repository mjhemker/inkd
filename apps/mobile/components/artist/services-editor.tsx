import { forwardRef, useImperativeHandle, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import {
  Badge,
  Button,
  Card,
  FormField,
  Icon,
  Input,
  Modal,
  TextArea,
  Toggle,
  cx,
  useToast,
} from "@inkd/ui/native";
import type { DepositType, Service, ServicePriceType } from "@inkd/core";
import { SERVICE_PRESETS } from "@inkd/core";
import {
  useServices,
  useCreateService,
  useUpdateService,
  useDeleteService,
} from "@inkd/core/hooks";

import { MoneyInput, formatMoney } from "./money";
import { PickerSelect } from "./pickers";
import type { EditorHandle } from "./types";

interface AddOn {
  name: string;
  price_cents: number | null;
}

interface ServiceDraft {
  id?: string;
  name: string;
  description: string;
  duration_minutes: number | null;
  price_type: ServicePriceType;
  price_cents: number | null;
  deposit_type: DepositType;
  deposit_amount_cents: number | null;
  deposit_percent: number | null;
  break_time_minutes: number;
  lead_time_hours: number;
  is_public: boolean;
  video_conferencing: boolean;
  add_ons: AddOn[];
}

const emptyDraft: ServiceDraft = {
  name: "",
  description: "",
  duration_minutes: 60,
  price_type: "fixed",
  price_cents: null,
  deposit_type: "none",
  deposit_amount_cents: null,
  deposit_percent: null,
  break_time_minutes: 0,
  lead_time_hours: 24,
  is_public: true,
  video_conferencing: false,
  add_ons: [],
};

const PRICE_TYPES = [
  { label: "Fixed price", value: "fixed" },
  { label: "Per hour", value: "hourly" },
  { label: "Starting at", value: "starting_at" },
  { label: "Quote only", value: "quote" },
];

const DEPOSIT_TYPES = [
  { label: "No deposit", value: "none" },
  { label: "Fixed amount", value: "fixed" },
  { label: "Percent of price", value: "percent" },
];

function draftFromService(s: Service): ServiceDraft {
  return {
    id: s.id,
    name: s.name,
    description: s.description ?? "",
    duration_minutes: s.duration_minutes,
    price_type: s.price_type,
    price_cents: s.price_cents,
    deposit_type: s.deposit_type,
    deposit_amount_cents: s.deposit_amount_cents,
    deposit_percent: s.deposit_percent,
    break_time_minutes: s.break_time_minutes,
    lead_time_hours: s.lead_time_hours,
    is_public: s.is_public,
    video_conferencing: s.video_conferencing,
    add_ons: Array.isArray(s.add_ons) ? (s.add_ons as unknown as AddOn[]) : [],
  };
}

export interface ServicesEditorProps {
  artistId: string;
  variant?: "onboarding" | "settings";
}

export const ServicesEditor = forwardRef<EditorHandle, ServicesEditorProps>(
  function ServicesEditor({ artistId }, ref) {
    const { toast } = useToast();
    const { data: services } = useServices(artistId);
    const createService = useCreateService(artistId);
    const updateService = useUpdateService(artistId);
    const deleteService = useDeleteService(artistId);

    const [draft, setDraft] = useState<ServiceDraft | null>(null);

    useImperativeHandle(ref, () => ({ save: async () => true }));

    const usedPresetKeys = new Set(
      (services ?? []).map((s) => s.preset_key).filter(Boolean),
    );

    async function addPreset(key: string) {
      const preset = SERVICE_PRESETS.find((p) => p.key === key);
      if (!preset) return;
      try {
        await createService.mutateAsync({
          name: preset.name,
          description: preset.description,
          duration_minutes: preset.duration_minutes,
          price_type: preset.price_type,
          price_cents: preset.price_cents,
          deposit_type: preset.deposit_type,
          deposit_amount_cents: preset.deposit_amount_cents,
          is_public: true,
          is_preset: true,
          preset_key: preset.key,
        });
        toast({ title: `${preset.name} added`, variant: "success" });
      } catch (err) {
        toast({
          title: "Couldn't add",
          description: err instanceof Error ? err.message : "Try again.",
          variant: "danger",
        });
      }
    }

    async function submitDraft() {
      if (!draft) return;
      if (!draft.name.trim()) {
        toast({ title: "Name your service", variant: "danger" });
        return;
      }
      const payload = {
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        duration_minutes: draft.duration_minutes,
        price_type: draft.price_type,
        price_cents: draft.price_type === "quote" ? null : draft.price_cents,
        deposit_type: draft.deposit_type,
        deposit_amount_cents: draft.deposit_type === "fixed" ? draft.deposit_amount_cents : null,
        deposit_percent: draft.deposit_type === "percent" ? draft.deposit_percent : null,
        break_time_minutes: draft.break_time_minutes,
        lead_time_hours: draft.lead_time_hours,
        is_public: draft.is_public,
        video_conferencing: draft.video_conferencing,
        add_ons: draft.add_ons.filter((a) => a.name.trim()) as unknown as Record<
          string,
          unknown
        >[],
      };
      try {
        if (draft.id) {
          await updateService.mutateAsync({ id: draft.id, patch: payload });
        } else {
          await createService.mutateAsync(payload);
        }
        setDraft(null);
        toast({ title: "Service saved", variant: "success" });
      } catch (err) {
        toast({
          title: "Couldn't save",
          description: err instanceof Error ? err.message : "Try again.",
          variant: "danger",
        });
      }
    }

    return (
      <View className="gap-6">
        {/* Presets */}
        <View className="gap-3">
          <Text className="text-sm font-sans-medium text-content-primary">Quick add</Text>
          <View className="flex-row flex-wrap gap-2.5">
            {SERVICE_PRESETS.map((p) => {
              const added = usedPresetKeys.has(p.key);
              return (
                <Pressable
                  key={p.key}
                  disabled={added}
                  onPress={() => void addPreset(p.key)}
                  className={cx(
                    "min-w-[47%] flex-1 gap-1 rounded-xl border border-border-subtle bg-surface-raised/50 px-3.5 py-3",
                    added && "opacity-50",
                  )}
                >
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm font-sans-medium text-content-primary">
                      {p.name}
                    </Text>
                    <Icon
                      name={added ? "check" : "plus"}
                      size={15}
                      color={added ? "#A78BFA" : "#A1A1AA"}
                    />
                  </View>
                  <Text className="text-xs text-content-muted">{p.duration_minutes} min</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Existing services */}
        {services && services.length > 0 && (
          <View className="gap-2.5">
            {services.map((s) => (
              <Card key={s.id} padding="sm" className="flex-row items-center gap-3">
                <View className="flex-1 gap-1">
                  <View className="flex-row flex-wrap items-center gap-2">
                    <Text className="text-sm font-sans-medium text-content-primary">
                      {s.name}
                    </Text>
                    {!s.is_public && (
                      <Badge variant="neutral" size="sm">
                        Hidden
                      </Badge>
                    )}
                    {s.video_conferencing && (
                      <Badge variant="info" size="sm">
                        Video
                      </Badge>
                    )}
                  </View>
                  <Text className="text-xs text-content-muted">
                    {s.duration_minutes ? `${s.duration_minutes} min · ` : ""}
                    {s.price_type === "quote" ? "Quote" : formatMoney(s.price_cents)}
                    {s.price_type === "hourly" ? "/hr" : ""}
                  </Text>
                </View>
                <Pressable
                  onPress={() => setDraft(draftFromService(s))}
                  accessibilityRole="button"
                  accessibilityLabel="Edit service"
                  className="h-8 w-8 items-center justify-center rounded-lg"
                >
                  <Icon name="settings" size={15} color="#71717A" />
                </Pressable>
                <Pressable
                  onPress={() => deleteService.mutate(s.id)}
                  accessibilityRole="button"
                  accessibilityLabel="Remove service"
                  className="h-8 w-8 items-center justify-center rounded-lg"
                >
                  <Icon name="x" size={16} color="#71717A" />
                </Pressable>
              </Card>
            ))}
          </View>
        )}

        <Button
          variant="outline"
          leadingIcon={<Icon name="plus" size={16} color="#FAFAFA" />}
          onPress={() => setDraft({ ...emptyDraft })}
          className="self-start"
        >
          Custom service
        </Button>

        {/* Custom service modal */}
        <Modal
          open={draft !== null}
          onClose={() => setDraft(null)}
          title={draft?.id ? "Edit service" : "New service"}
          className="max-h-[85%]"
          footer={
            <>
              <Button variant="ghost" onPress={() => setDraft(null)}>
                Cancel
              </Button>
              <Button
                onPress={() => void submitDraft()}
                loading={createService.isPending || updateService.isPending}
              >
                Save service
              </Button>
            </>
          }
        >
          {draft && (
            <ScrollView className="max-h-[420px]" contentContainerClassName="gap-4">
              <FormField label="Name" required>
                <Input
                  placeholder="Custom half-sleeve"
                  value={draft.name}
                  onChangeText={(v) => setDraft({ ...draft, name: v })}
                />
              </FormField>

              <FormField label="Description">
                <TextArea
                  numberOfLines={2}
                  placeholder="What this booking covers."
                  value={draft.description}
                  onChangeText={(v) => setDraft({ ...draft, description: v })}
                />
              </FormField>

              <View className="flex-row gap-3">
                <View className="flex-1">
                  <FormField label="Duration (min)">
                    <Input
                      inputMode="numeric"
                      keyboardType="number-pad"
                      value={draft.duration_minutes?.toString() ?? ""}
                      onChangeText={(v) =>
                        setDraft({
                          ...draft,
                          duration_minutes: v ? Number(v.replace(/\D/g, "")) : null,
                        })
                      }
                    />
                  </FormField>
                </View>
                <View className="flex-1">
                  <FormField label="Pricing">
                    <PickerSelect
                      title="Pricing"
                      options={PRICE_TYPES}
                      value={draft.price_type}
                      onValueChange={(v) =>
                        setDraft({ ...draft, price_type: v as ServicePriceType })
                      }
                    />
                  </FormField>
                </View>
              </View>

              {draft.price_type !== "quote" && (
                <FormField label="Price">
                  <MoneyInput
                    valueCents={draft.price_cents}
                    onValueChange={(c) => setDraft({ ...draft, price_cents: c })}
                  />
                </FormField>
              )}

              <FormField label="Deposit">
                <PickerSelect
                  title="Deposit"
                  options={DEPOSIT_TYPES}
                  value={draft.deposit_type}
                  onValueChange={(v) => setDraft({ ...draft, deposit_type: v as DepositType })}
                />
              </FormField>

              {draft.deposit_type === "fixed" && (
                <FormField label="Deposit amount">
                  <MoneyInput
                    valueCents={draft.deposit_amount_cents}
                    onValueChange={(c) => setDraft({ ...draft, deposit_amount_cents: c })}
                  />
                </FormField>
              )}
              {draft.deposit_type === "percent" && (
                <FormField label="Deposit %">
                  <Input
                    inputMode="numeric"
                    keyboardType="number-pad"
                    placeholder="20"
                    value={draft.deposit_percent?.toString() ?? ""}
                    onChangeText={(v) =>
                      setDraft({
                        ...draft,
                        deposit_percent: v ? Number(v.replace(/\D/g, "")) : null,
                      })
                    }
                  />
                </FormField>
              )}

              <View className="flex-row gap-3">
                <View className="flex-1">
                  <FormField label="Break after (min)">
                    <Input
                      inputMode="numeric"
                      keyboardType="number-pad"
                      value={draft.break_time_minutes.toString()}
                      onChangeText={(v) =>
                        setDraft({
                          ...draft,
                          break_time_minutes: Number(v.replace(/\D/g, "") || "0"),
                        })
                      }
                    />
                  </FormField>
                </View>
                <View className="flex-1">
                  <FormField label="Lead time (hrs)">
                    <Input
                      inputMode="numeric"
                      keyboardType="number-pad"
                      value={draft.lead_time_hours.toString()}
                      onChangeText={(v) =>
                        setDraft({
                          ...draft,
                          lead_time_hours: Number(v.replace(/\D/g, "") || "0"),
                        })
                      }
                    />
                  </FormField>
                </View>
              </View>

              {/* Add-ons */}
              <View className="gap-2">
                <Text className="text-sm font-sans-medium text-content-primary">Add-ons</Text>
                {draft.add_ons.map((a, i) => (
                  <View key={i} className="flex-row items-center gap-2">
                    <Input
                      className="flex-1"
                      placeholder="Add-on name"
                      value={a.name}
                      onChangeText={(v) => {
                        const next = [...draft.add_ons];
                        next[i] = { ...a, name: v };
                        setDraft({ ...draft, add_ons: next });
                      }}
                    />
                    <View className="w-28">
                      <MoneyInput
                        valueCents={a.price_cents}
                        onValueChange={(c) => {
                          const next = [...draft.add_ons];
                          next[i] = { ...a, price_cents: c };
                          setDraft({ ...draft, add_ons: next });
                        }}
                      />
                    </View>
                    <Pressable
                      onPress={() =>
                        setDraft({ ...draft, add_ons: draft.add_ons.filter((_, j) => j !== i) })
                      }
                      accessibilityRole="button"
                      accessibilityLabel="Remove add-on"
                      className="h-9 w-9 items-center justify-center rounded-lg"
                    >
                      <Icon name="x" size={15} color="#71717A" />
                    </Pressable>
                  </View>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  className="self-start"
                  leadingIcon={<Icon name="plus" size={14} color="#A1A1AA" />}
                  onPress={() =>
                    setDraft({
                      ...draft,
                      add_ons: [...draft.add_ons, { name: "", price_cents: null }],
                    })
                  }
                >
                  Add-on
                </Button>
              </View>

              <View className="gap-3 rounded-xl border border-border-subtle bg-surface-raised/40 px-4 py-3.5">
                <Toggle
                  checked={draft.is_public}
                  onCheckedChange={(v) => setDraft({ ...draft, is_public: v })}
                  label="Show on my public menu"
                />
                <Toggle
                  checked={draft.video_conferencing}
                  onCheckedChange={(v) => setDraft({ ...draft, video_conferencing: v })}
                  label="Offer over video call"
                />
              </View>
            </ScrollView>
          )}
        </Modal>
      </View>
    );
  },
);
