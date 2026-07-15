import { Text, View } from "react-native";
import { Icon } from "@inkd/ui/native";
import type { AgentRole } from "@inkd/core";

import { staffMeta } from "@/lib/aiStaff";
import { AI_COLORS } from "./shared";

/** A member of staff as a mono nameplate with an ember-stamped monogram. */
export function StaffNameplate({ role }: { role: AgentRole | null }) {
  const meta = staffMeta(role);
  return (
    <View className="flex-row items-center gap-2.5">
      <View className="h-7 w-7 items-center justify-center rounded-sm bg-surface-ember">
        <Icon name={meta.icon} size={15} color={AI_COLORS.emberInk} />
      </View>
      <Text className="font-mono text-[11px] uppercase tracking-wider text-content-primary">
        {meta.name}
      </Text>
    </View>
  );
}
