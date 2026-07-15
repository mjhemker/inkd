import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Text, View } from "react-native";
import { Badge, Button, Icon, Slider, useToast } from "@inkd/ui/native";
import type { AgentAutonomyEnum, ArtistProfile } from "@inkd/core";
import { ACTION_CLASSES, AUTONOMY_BY_INDEX, AUTONOMY_LEVELS } from "@inkd/core";
import { useAgentSettings, useUpsertAgentSettings } from "@inkd/core/hooks";

import { PickerSelect } from "./pickers";
import { ProStamp } from "./ProStamp";
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

export const AgentAutonomyEditor = forwardRef<EditorHandle, AgentAutonomyEditorProps>(
  function AgentAutonomyEditor({ artist, variant = "onboarding" }, ref) {
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
        setOverrides((settings.action_class_overrides as Record<string, string> | null) ?? {});
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
      <View className="gap-6">
        <View className="flex-row items-start gap-3 rounded-xl border border-border-subtle bg-surface-raised/40 p-4">
          <View className="h-9 w-9 items-center justify-center rounded-lg bg-surface-overlay">
            <Icon name="sparkles" size={17} color="#A78BFA" />
          </View>
          <Text className="flex-1 text-sm text-content-secondary">
            Your AI staff can help run the front desk — answering questions, collecting
            booking details, and keeping clients warm. You decide how much they do on
            their own. You can change this anytime, and everything they do is logged
            for you to review.
          </Text>
        </View>

        <View className="gap-4 rounded-2xl border border-border-subtle bg-surface-raised p-5">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-sans-medium text-content-primary">
              Autonomy level
            </Text>
            <Badge variant="brand">{level.label}</Badge>
          </View>

          <Slider value={index} onValueChange={setIndex} min={0} max={3} step={1} />

          <View className="flex-row justify-between px-1">
            {AUTONOMY_LEVELS.map((l) => (
              <Text
                key={l.value}
                className={
                  l.index === index
                    ? "font-mono text-[10px] uppercase tracking-wide text-content-accent"
                    : "font-mono text-[10px] uppercase tracking-wide text-content-muted"
                }
              >
                {l.short}
              </Text>
            ))}
          </View>

          <Text className="rounded-lg bg-surface-overlay/60 px-3.5 py-3 text-sm text-content-secondary">
            {level.description}
          </Text>

          {variant === "settings" && level.pilotNote && (
            <View className="flex-row items-center gap-2">
              <ProStamp />
              <Text className="font-mono text-[11px] uppercase tracking-wide text-content-accent">
                {level.pilotNote}
              </Text>
            </View>
          )}
        </View>

        {variant === "settings" && (
          <View className="gap-3">
            <View className="gap-1">
              <Text className="text-sm font-sans-medium text-content-primary">
                Fine-tune by task
              </Text>
              <Text className="text-xs text-content-muted">
                Override the default for specific actions. Sensitive tasks always stay
                with you.
              </Text>
            </View>
            <View className="divide-y divide-border-subtle rounded-xl border border-border-subtle">
              {ACTION_CLASSES.map((ac) => (
                <View key={ac.key} className="gap-3 px-4 py-3">
                  <View className="gap-1">
                    <View className="flex-row items-center gap-2">
                      <Text className="text-sm text-content-primary">{ac.label}</Text>
                      <Badge variant="neutral" size="sm">
                        Tier {ac.tier}
                      </Badge>
                    </View>
                    <Text className="text-xs text-content-muted">{ac.description}</Text>
                  </View>
                  <PickerSelect
                    title={ac.label}
                    size="sm"
                    options={OVERRIDE_OPTIONS}
                    value={overrides[ac.key] ?? "default"}
                    disabled={ac.tier === 3}
                    onValueChange={(v) =>
                      setOverrides((prev) => ({ ...prev, [ac.key]: v }))
                    }
                  />
                </View>
              ))}
            </View>
            <View className="items-end">
              <Button onPress={() => void save()} loading={upsert.isPending}>
                Save changes
              </Button>
            </View>
          </View>
        )}
      </View>
    );
  },
);
