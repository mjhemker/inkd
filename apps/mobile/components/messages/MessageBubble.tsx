import { Text, View } from "react-native";
import { Icon, cx } from "@inkd/ui/native";
import { formatMessageTime } from "@inkd/core/utils";
import type { Message } from "@inkd/core/types";

/**
 * One chat bubble. `isMine` sets side + color; `sender_kind === "agent"`
 * (SPEC §5 trust requirements) gets its own treatment on top — a mono
 * "Drafted by AI staff" eyebrow and a dashed, tinted bubble — so AI-authored
 * copy is never mistaken for a human's own words. A human-sent message that
 * was `drafted_by_agent` gets a quieter provenance line for the same reason.
 */
export function MessageBubble({ message, isMine }: { message: Message; isMine: boolean }) {
  const isAgent = message.sender_kind === "agent";
  const isHumanDraftedByAgent = !isAgent && message.drafted_by_agent;

  return (
    <View className={cx("mb-3 flex-col", isMine ? "items-end" : "items-start")}>
      {isAgent && (
        <View className="mb-1 flex-row items-center gap-1 pl-0.5">
          <Icon name="sparkles" size={11} color="#A78BFA" />
          <Text className="font-mono text-[10px] uppercase tracking-widest text-content-accent">
            Drafted by AI staff
          </Text>
        </View>
      )}
      <View
        className={cx(
          "max-w-[80%] rounded-2xl px-3.5 py-2.5",
          isAgent
            ? "rounded-br-sm border border-dashed border-brand/45 bg-brand/10"
            : isMine
              ? "rounded-br-sm bg-brand"
              : "rounded-bl-sm bg-surface-overlay",
        )}
      >
        <Text
          className={cx(
            "font-sans text-sm leading-relaxed",
            isAgent ? "text-content-primary" : isMine ? "text-brand-on" : "text-content-primary",
          )}
        >
          {message.body ?? "Empty message"}
        </Text>
        {isHumanDraftedByAgent && (
          <View className="mt-1.5 flex-row items-center gap-1">
            <Icon name="sparkles" size={10} color={isMine ? "#FAFAFA" : "#71717A"} />
            <Text
              className={cx(
                "font-mono text-[10px] uppercase tracking-widest",
                isMine ? "text-brand-on/70" : "text-content-muted",
              )}
            >
              AI-drafted, sent by hand
            </Text>
          </View>
        )}
      </View>
      <Text className="mt-1 px-0.5 font-mono text-[11px] text-content-muted">
        {formatMessageTime(message.created_at)}
      </Text>
    </View>
  );
}
