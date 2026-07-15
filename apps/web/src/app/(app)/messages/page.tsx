import { EmptyState, Icon } from "@inkd/ui/web";

/**
 * Right pane at `/messages` with no thread selected (desktop only — mobile
 * shows the list instead via `MessagesShell`'s route-based visibility).
 */
export default function MessagesIndexPage() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center">
      <EmptyState
        icon={<Icon name="message-circle" size={26} />}
        title="Select a conversation"
        description="Pick a thread on the left, or start a new one from an artist's profile."
      />
    </div>
  );
}
