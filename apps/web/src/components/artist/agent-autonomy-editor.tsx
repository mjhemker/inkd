"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  Badge,
  Button,
  Icon,
  Select,
  Slider,
  useToast,
} from "@inkd/ui/web";
import type { AgentAutonomyEnum, ArtistProfile } from "@inkd/core";
import { useAgentSettings, useUpsertAgentSettings } from "@inkd/core/hooks";

import { ACTION_CLASSES, AUTONOMY_BY_INDEX, AUTONOMY_LEVELS } from "./constants";
import type { EditorHandle } from "./types";

const OVERRIDE_OPTIONS = [
  { label: "Use my default", value: "default" },
  { label: "Draft for me", value: "draft" },
  { label: "Do it automatically", value: "auto" },
  { label: "Always me", value: "artist_only" },
];

function indexForAutonomy(a: AgentAutonomyEnum | undefined): number {
  return AUTONOMY_LEVELS.find((l) => l.value === a)?.index ?? 1;
}

export interface AgentAutonomyEditorProps {
  artist: ArtistProfile;
  variant?: "onboarding" | "settings";
}

export const AgentAutonomyEditor = forwardRef<
  EditorHandle,
  AgentAutonomyEditorProps
>(function AgentAutonomyEditor({ artist, variant = "onboarding" }, ref) {
  const { toast } = useToast();
  const { data: settings } = useAgentSettings(artist.id);
  const upsert = useUpsertAgentSettings(artist.id);

  const [index, setIndex] = useState<number>(indexForAutonomy(settings?.autonomy));
  const [overrides, setOverrides] = useState<Record<string, string>>(
    (settings?.action_class_overrides as Record<string, string> | null) ?? {},
  );
  const seeded = useRef(false);

  // Seed once the saved settings arrive (they load after first render).
  useEffect(() => {
    if (seeded.current || settings === undefined) return;
    seeded.current = true;
    if (settings) {
      setIndex(indexForAutonomy(settings.autonomy));
      setOverrides(
        (settings.action_class_overrides as Record<string, string> | null) ?? {},
      );
    }
  }, [settings]);

  const level = AUTONOMY_LEVELS[index] ?? AUTONOMY_LEVELS[1]!;

  async function save(): Promise<boolean> {
    try {
      await upsert.mutateAsync({
        autonomy: AUTONOMY_BY_INDEX[index] ?? "draft_only",
        action_class_overrides: overrides,
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-3 rounded-xl border border-border-subtle bg-surface-raised/40 p-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-overlay text-content-accent">
          <Icon name="sparkles" size={17} />
        </span>
        <p className="text-sm text-content-secondary">
          Your AI staff can help run the front desk — answering questions,
          collecting booking details, and keeping clients warm. You decide how
          much they do on their own. You can change this anytime, and everything
          they do is logged for you to review.
        </p>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-border-subtle bg-surface-raised p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-content-primary">
            Autonomy level
          </span>
          <Badge variant="brand">{level.label}</Badge>
        </div>

        <Slider value={index} onValueChange={setIndex} min={0} max={3} step={1} />

        <div className="flex justify-between px-1 font-mono text-[10px] uppercase tracking-wide text-content-muted">
          {AUTONOMY_LEVELS.map((l) => (
            <span
              key={l.value}
              className={l.index === index ? "text-content-accent" : undefined}
            >
              {l.short}
            </span>
          ))}
        </div>

        <p className="rounded-lg bg-surface-overlay/60 px-3.5 py-3 text-sm text-content-secondary">
          {level.description}
        </p>
      </div>

      {variant === "settings" && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-content-primary">
              Fine-tune by task
            </span>
            <span className="text-xs text-content-muted">
              Override the default for specific actions. Sensitive tasks always
              stay with you.
            </span>
          </div>
          <div className="flex flex-col divide-y divide-border-subtle rounded-xl border border-border-subtle">
            {ACTION_CLASSES.map((ac) => (
              <div
                key={ac.key}
                className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex flex-col">
                  <span className="flex items-center gap-2 text-sm text-content-primary">
                    {ac.label}
                    <Badge variant="neutral" size="sm">
                      Tier {ac.tier}
                    </Badge>
                  </span>
                  <span className="text-xs text-content-muted">
                    {ac.description}
                  </span>
                </div>
                <div className="w-full sm:w-48">
                  <Select
                    size="sm"
                    options={OVERRIDE_OPTIONS}
                    value={overrides[ac.key] ?? "default"}
                    disabled={ac.tier === 3}
                    onChange={(e) =>
                      setOverrides((prev) => ({
                        ...prev,
                        [ac.key]: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <Button onClick={() => void save()} loading={upsert.isPending}>
              Save changes
            </Button>
          </div>
        </div>
      )}
    </div>
  );
});
