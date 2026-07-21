import { Pressable, Text, View } from "react-native";
import { Badge, Card, Icon, StatusDot } from "@inkd/ui/native";
import type { AgentSettings } from "@inkd/core";

import { AUTONOMY_LABEL, STAFF } from "@/lib/aiStaff";
import { useStudioNav } from "@/components/studio/StudioNav";
import { useAiColors } from "./shared";

/**
 * Front Desk, Booking Manager + Studio Manager as a compact status row — a
 * StatusDot + mono nameplate + ON/OFF + one line of role copy per staff, all
 * flat hairline cards. The header carries a compact "AUTONOMY · <level>" link
 * and a red "N AWAITING YOU" stamp when anything's waiting (red = counts only).
 */
export function StaffOverview({
  settings,
  pendingCount,
}: {
  settings: AgentSettings | null | undefined;
  pendingCount: number;
}) {
  const AI_COLORS = useAiColors();
  const goToSegment = useStudioNav();
  const autonomy = settings?.autonomy ?? "draft_only";
  const enabled: Record<string, boolean> = {
    front_desk: settings?.front_desk_enabled ?? true,
    booking_manager: settings?.booking_manager_enabled ?? true,
    studio_manager: settings?.studio_manager_enabled ?? true,
  };

  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between gap-2">
        {pendingCount > 0 ? (
          <Badge variant="stamp" size="md">{`${pendingCount} AWAITING YOU`}</Badge>
        ) : (
          <View />
        )}
        <Pressable
          onPress={() => goToSegment("settings")}
          className="flex-row items-center gap-2 rounded-sm border border-border-subtle bg-surface-raised px-3 py-1.5"
          accessibilityRole="button"
        >
          <Text className="font-mono text-[11px] uppercase tracking-widest text-content-secondary">
            {`Autonomy · ${AUTONOMY_LABEL[autonomy] ?? autonomy}`}
          </Text>
          <Icon name="settings" size={13} color={AI_COLORS.muted} />
        </Pressable>
      </View>

      {STAFF.map((staff) => {
        const on = enabled[staff.role] ?? true;
        return (
          <Card key={staff.role} padding="sm" className="flex-row items-start gap-2.5">
            <View className="mt-1">
              <StatusDot on={on} />
            </View>
            <View className="flex-1 gap-0.5">
              <View className="flex-row items-center gap-2">
                <Text className="font-mono text-[11px] uppercase tracking-wider text-content-primary">
                  {staff.name}
                </Text>
                <Text
                  className={`font-mono text-[10px] uppercase tracking-widest ${on ? "text-success-600" : "text-content-muted"}`}
                >
                  {on ? "On" : "Off"}
                </Text>
              </View>
              <Text className="text-xs leading-snug text-content-muted">{staff.short}</Text>
            </View>
          </Card>
        );
      })}
    </View>
  );
}
