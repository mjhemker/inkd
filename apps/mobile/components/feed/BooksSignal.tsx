import { Text, View } from "react-native";
import { cx } from "@inkd/ui/native";

export interface BooksSignalProps {
  acceptsNewClients: boolean;
  className?: string;
}

/** Tiny mono books-open/closed signal for a feed card's museum placard. */
export function BooksSignal({ acceptsNewClients, className }: BooksSignalProps) {
  return (
    <View className={cx("flex-row items-center gap-1", className)}>
      <View
        className={cx(
          "h-1.5 w-1.5 rounded-full",
          acceptsNewClients ? "bg-success-500" : "bg-content-muted",
        )}
      />
      <Text
        className={cx(
          "font-mono text-[10px] uppercase tracking-widest",
          acceptsNewClients ? "text-success-500" : "text-content-muted",
        )}
      >
        {acceptsNewClients ? "Books open" : "Books closed"}
      </Text>
    </View>
  );
}
