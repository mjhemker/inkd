import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Badge, Card, Icon } from "@inkd/ui/native";
import type { AgentSettings } from "@inkd/core";

import { AUTONOMY_LABEL, STAFF } from "@/lib/aiStaff";
import { useAiColors } from "./shared";

/** Front Desk, Booking Manager + Studio Manager as staff, with autonomy +
 * pending count. Renders one card per STAFF role in a vertical stack. */
export function StaffOverview({
  settings,
  pendingCount,
}: {
  settings: AgentSettings | null | undefined;
  pendingCount: number;
}) {
  const AI_COLORS = useAiColors();
  const autonomy = settings?.autonomy ?? "draft_only";
  const enabled: Record<string, boolean> = {
    front_desk: settings?.front_desk_enabled ?? true,
    booking_manager: settings?.booking_manager_enabled ?? true,
    studio_manager: settings?.studio_manager_enabled ?? true,
  };

  return (
    <View className="gap-3">
      <Pressable
        onPress={() => router.push("/studio/settings" as never)}
        className="flex-row items-center justify-between rounded-sm border border-border-subtle bg-surface-raised px-3 py-2.5"
        accessibilityRole="button"
      >
        <View>
          <Text className="font-mono text-[10px] uppercase tracking-widest text-content-muted">
            Autonomy
          </Text>
          <Text className="text-sm font-semibold text-content-primary">
            {AUTONOMY_LABEL[autonomy] ?? autonomy}
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          <View className="items-end">
            <Text className="font-display text-xl text-content-primary">{pendingCount}</Text>
            <Text className="font-mono text-[9px] uppercase tracking-widest text-content-muted">
              awaiting you
            </Text>
          </View>
          <Icon name="settings" size={16} color={AI_COLORS.muted} />
        </View>
      </Pressable>

      {STAFF.map((staff) => {
        const on = enabled[staff.role] ?? true;
        return (
          <Card key={staff.role} padding="md" className="flex-row items-start gap-3">
            <View className={`h-10 w-10 items-center justify-center rounded-sm ${on ? "bg-surface-ember" : "bg-surface-overlay"}`}>
              <Icon name={staff.icon} size={19} color={on ? AI_COLORS.emberInk : AI_COLORS.muted} />
            </View>
            <View className="flex-1 gap-0.5">
              <View className="flex-row items-center gap-2">
                <Text className="font-mono text-[12px] uppercase tracking-wider text-content-primary">
                  {staff.name}
                </Text>
                <Badge variant={on ? "success" : "neutral"} size="sm">
                  {on ? "On" : "Off"}
                </Badge>
              </View>
              <Text className="text-xs leading-snug text-content-muted">{staff.title}</Text>
            </View>
          </Card>
        );
      })}
    </View>
  );
}
