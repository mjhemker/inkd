"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import {
  Badge,
  Button,
  Card,
  FormField,
  Icon,
  Input,
  Modal,
  Select,
  TextArea,
  Toggle,
  useToast,
} from "@inkd/ui/web";
import type { DepositType, Service, ServicePriceType } from "@inkd/core";
import {
  useServices,
  useCreateService,
  useUpdateService,
  useDeleteService,
} from "@inkd/core/hooks";

import { SERVICE_PRESETS } from "./constants";
import { MoneyInput, formatMoney } from "./money";
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
        deposit_amount_cents:
          draft.deposit_type === "fixed" ? draft.deposit_amount_cents : null,
        deposit_percent:
          draft.deposit_type === "percent" ? draft.deposit_percent : null,
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
      <div className="flex flex-col gap-6">
        {/* Presets */}
        <div className="flex flex-col gap-3">
          <span className="text-sm font-medium text-content-primary">
            Quick add
          </span>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {SERVICE_PRESETS.map((p) => {
              const added = usedPresetKeys.has(p.key);
              return (
                <button
                  key={p.key}
                  type="button"
                  disabled={added}
                  onClick={() => void addPreset(p.key)}
                  className="flex flex-col items-start gap-1 rounded-xl border border-border-subtle bg-surface-raised/50 px-3.5 py-3 text-left outline-none transition-colors hover:border-border-accent focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="flex w-full items-center justify-between">
                    <span className="text-sm font-medium text-content-primary">
                      {p.name}
                    </span>
                    <Icon name={added ? "check" : "plus"} size={15} />
                  </span>
                  <span className="text-xs text-content-muted">
                    {p.duration_minutes} min
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Existing services */}
        {services && services.length > 0 && (
          <div className="flex flex-col gap-2.5">
            {services.map((s) => (
              <Card key={s.id} padding="sm" className="flex items-center gap-3">
                <div className="flex flex-1 flex-col">
                  <span className="flex items-center gap-2 text-sm font-medium text-content-primary">
                    {s.name}
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
                  </span>
                  <span className="text-xs text-content-muted">
                    {s.duration_minutes ? `${s.duration_minutes} min · ` : ""}
                    {s.price_type === "quote"
                      ? "Quote"
                      : formatMoney(s.price_cents)}
                    {s.price_type === "hourly" ? "/hr" : ""}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setDraft(draftFromService(s))}
                  className="grid h-8 w-8 place-items-center rounded-lg text-content-muted outline-none transition-colors hover:bg-surface-overlay hover:text-content-primary focus-visible:ring-2 focus-visible:ring-brand"
                  aria-label="Edit service"
                >
                  <Icon name="settings" size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => deleteService.mutate(s.id)}
                  className="grid h-8 w-8 place-items-center rounded-lg text-content-muted outline-none transition-colors hover:bg-surface-overlay hover:text-danger-500 focus-visible:ring-2 focus-visible:ring-brand"
                  aria-label="Remove service"
                >
                  <Icon name="x" size={16} />
                </button>
              </Card>
            ))}
          </div>
        )}

        <Button
          variant="outline"
          leadingIcon={<Icon name="plus" size={16} />}
          onClick={() => setDraft({ ...emptyDraft })}
          className="self-start"
        >
          Custom service
        </Button>

        {/* Custom service modal */}
        <Modal
          open={draft !== null}
          onClose={() => setDraft(null)}
          title={draft?.id ? "Edit service" : "New service"}
          size="lg"
          footer={
            <>
              <Button variant="ghost" onClick={() => setDraft(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => void submitDraft()}
                loading={createService.isPending || updateService.isPending}
              >
                Save service
              </Button>
            </>
          }
        >
          {draft && (
            <div className="flex flex-col gap-4">
              <FormField label="Name" htmlFor="svc-name" required>
                <Input
                  id="svc-name"
                  placeholder="Custom half-sleeve"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </FormField>

              <FormField label="Description" htmlFor="svc-desc">
                <TextArea
                  id="svc-desc"
                  rows={2}
                  placeholder="What this booking covers."
                  value={draft.description}
                  onChange={(e) =>
                    setDraft({ ...draft, description: e.target.value })
                  }
                />
              </FormField>

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Duration (min)" htmlFor="svc-dur">
                  <Input
                    id="svc-dur"
                    inputMode="numeric"
                    value={draft.duration_minutes?.toString() ?? ""}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        duration_minutes: e.target.value
                          ? Number(e.target.value.replace(/\D/g, ""))
                          : null,
                      })
                    }
                  />
                </FormField>
                <FormField label="Pricing" htmlFor="svc-ptype">
                  <Select
                    id="svc-ptype"
                    options={PRICE_TYPES}
                    value={draft.price_type}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        price_type: e.target.value as ServicePriceType,
                      })
                    }
                  />
                </FormField>
              </div>

              {draft.price_type !== "quote" && (
                <FormField label="Price" htmlFor="svc-price">
                  <MoneyInput
                    id="svc-price"
                    valueCents={draft.price_cents}
                    onValueChange={(c) => setDraft({ ...draft, price_cents: c })}
                  />
                </FormField>
              )}

              <FormField label="Deposit" htmlFor="svc-dtype">
                <Select
                  id="svc-dtype"
                  options={DEPOSIT_TYPES}
                  value={draft.deposit_type}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      deposit_type: e.target.value as DepositType,
                    })
                  }
                />
              </FormField>

              {draft.deposit_type === "fixed" && (
                <FormField label="Deposit amount" htmlFor="svc-damt">
                  <MoneyInput
                    id="svc-damt"
                    valueCents={draft.deposit_amount_cents}
                    onValueChange={(c) =>
                      setDraft({ ...draft, deposit_amount_cents: c })
                    }
                  />
                </FormField>
              )}
              {draft.deposit_type === "percent" && (
                <FormField label="Deposit %" htmlFor="svc-dpct">
                  <Input
                    id="svc-dpct"
                    inputMode="numeric"
                    placeholder="20"
                    value={draft.deposit_percent?.toString() ?? ""}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        deposit_percent: e.target.value
                          ? Number(e.target.value.replace(/\D/g, ""))
                          : null,
                      })
                    }
                  />
                </FormField>
              )}

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Break after (min)" htmlFor="svc-break">
                  <Input
                    id="svc-break"
                    inputMode="numeric"
                    value={draft.break_time_minutes.toString()}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        break_time_minutes: Number(
                          e.target.value.replace(/\D/g, "") || "0",
                        ),
                      })
                    }
                  />
                </FormField>
                <FormField label="Lead time (hrs)" htmlFor="svc-lead">
                  <Input
                    id="svc-lead"
                    inputMode="numeric"
                    value={draft.lead_time_hours.toString()}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        lead_time_hours: Number(
                          e.target.value.replace(/\D/g, "") || "0",
                        ),
                      })
                    }
                  />
                </FormField>
              </div>

              {/* Add-ons */}
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-content-primary">
                  Add-ons
                </span>
                {draft.add_ons.map((a, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      className="flex-1"
                      placeholder="Add-on name"
                      value={a.name}
                      onChange={(e) => {
                        const next = [...draft.add_ons];
                        next[i] = { ...a, name: e.target.value };
                        setDraft({ ...draft, add_ons: next });
                      }}
                    />
                    <div className="w-28">
                      <MoneyInput
                        valueCents={a.price_cents}
                        onValueChange={(c) => {
                          const next = [...draft.add_ons];
                          next[i] = { ...a, price_cents: c };
                          setDraft({ ...draft, add_ons: next });
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          add_ons: draft.add_ons.filter((_, j) => j !== i),
                        })
                      }
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-content-muted outline-none hover:text-danger-500 focus-visible:ring-2 focus-visible:ring-brand"
                      aria-label="Remove add-on"
                    >
                      <Icon name="x" size={15} />
                    </button>
                  </div>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  className="self-start"
                  leadingIcon={<Icon name="plus" size={14} />}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      add_ons: [...draft.add_ons, { name: "", price_cents: null }],
                    })
                  }
                >
                  Add-on
                </Button>
              </div>

              <div className="flex flex-col gap-3 rounded-xl border border-border-subtle bg-surface-raised/40 px-4 py-3.5">
                <Toggle
                  checked={draft.is_public}
                  onCheckedChange={(v) => setDraft({ ...draft, is_public: v })}
                  label="Show on my public menu"
                />
                <Toggle
                  checked={draft.video_conferencing}
                  onCheckedChange={(v) =>
                    setDraft({ ...draft, video_conferencing: v })
                  }
                  label="Offer over video call"
                />
              </div>
            </div>
          )}
        </Modal>
      </div>
    );
  },
);
