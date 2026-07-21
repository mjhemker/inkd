import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import {
  Button,
  Card,
  CardPlacard,
  Chip,
  EmptyState,
  Icon,
  Input,
  Skeleton,
  TextArea,
  useToast,
} from "@inkd/ui/native";
import type { AgentPlaybook, PlaybookCategory } from "@inkd/core";
import {
  useCreatePlaybook,
  useDeletePlaybook,
  usePlaybooks,
  useUpdatePlaybook,
} from "@inkd/core/hooks";

import { PLAYBOOK_CATEGORY_LABEL } from "@/lib/aiStaff";
import { useAiColors } from "./shared";

const CATEGORIES = Object.keys(PLAYBOOK_CATEGORY_LABEL) as PlaybookCategory[];

/** Playbook CRUD — the honest knowledge base the AI staff answer from. */
export function PlaybookSection({ artistId }: { artistId: string }) {
  const AI_COLORS = useAiColors();
  const { toast } = useToast();
  const listQ = usePlaybooks(artistId);
  const create = useCreatePlaybook(artistId);
  const del = useDeletePlaybook(artistId);

  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<PlaybookCategory>("faq");
  const [content, setContent] = useState("");

  const entries = listQ.data ?? [];

  async function handleCreate() {
    if (!content.trim()) return;
    try {
      await create.mutateAsync({
        title: title.trim() || null,
        category,
        content: content.trim(),
      });
      setTitle("");
      setContent("");
      setCategory("faq");
      setAdding(false);
      toast({ title: "Playbook entry added" });
    } catch (err) {
      toast({
        title: "Couldn't add entry",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "danger",
      });
    }
  }

  return (
    <View className="gap-4">
      <View className="flex-row items-start gap-3 rounded-sm border border-border-subtle bg-surface-plate-ink/50 p-3.5">
        <Icon name="shield" size={17} color={AI_COLORS.accent} />
        <Text className="flex-1 text-sm leading-relaxed text-content-secondary">
          Your AI staff answer only from this playbook plus your published rates
          and hours. If it isn’t written here, they won’t make it up — they hand
          off to you instead.
        </Text>
      </View>

      <View className="flex-row items-center justify-between">
        <Text className="font-sans text-sm font-semibold text-content-primary">
          {`Entries${entries.length ? ` (${entries.length})` : ""}`}
        </Text>
        {!adding ? (
          <Button hero onPress={() => setAdding(true)}>
            Add entry
          </Button>
        ) : null}
      </View>

      {adding ? (
        <Card padding="md" variant="raised" className="gap-3">
          <Input placeholder="Title (optional)" value={title} onChangeText={setTitle} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 pr-4">
            {CATEGORIES.map((c) => (
              <Chip key={c} selected={category === c} onPress={() => setCategory(c)}>
                {PLAYBOOK_CATEGORY_LABEL[c] ?? c}
              </Chip>
            ))}
          </ScrollView>
          <TextArea
            placeholder="What should your staff know or say?"
            value={content}
            onChangeText={setContent}
            numberOfLines={4}
          />
          <View className="flex-row justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onPress={() => {
                setAdding(false);
                setTitle("");
                setContent("");
              }}
            >
              Cancel
            </Button>
            <Button size="sm" loading={create.isPending} disabled={!content.trim()} onPress={() => void handleCreate()}>
              Save entry
            </Button>
          </View>
        </Card>
      ) : null}

      {listQ.isLoading ? (
        <View className="gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </View>
      ) : entries.length === 0 && !adding ? (
        <EmptyState
          icon={<Icon name="image" size={22} color={AI_COLORS.muted} />}
          title="No playbook entries yet"
          description="Add your FAQs, tone, and policies so your staff can answer them for you."
        />
      ) : (
        <View className="gap-2.5">
          {entries.map((entry) => (
            <PlaybookRow
              key={entry.id}
              entry={entry}
              onDelete={async () => {
                try {
                  await del.mutateAsync(entry.id);
                  toast({ title: "Entry removed" });
                } catch (err) {
                  toast({
                    title: "Couldn't remove",
                    description: err instanceof Error ? err.message : "Try again.",
                    variant: "danger",
                  });
                }
              }}
              deleting={del.isPending}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function PlaybookRow({
  entry,
  onDelete,
  deleting,
}: {
  entry: AgentPlaybook;
  onDelete: () => void;
  deleting: boolean;
}) {
  const { toast } = useToast();
  const update = useUpdatePlaybook(entry.artist_id);
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(entry.content);

  async function save() {
    try {
      await update.mutateAsync({ id: entry.id, input: { content: content.trim() } });
      setEditing(false);
    } catch (err) {
      toast({
        title: "Couldn't save",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "danger",
      });
    }
  }

  return (
    <Card padding="none" className="overflow-hidden">
      <CardPlacard
        meta={
          entry.source === "onboarding"
            ? "from onboarding"
            : entry.source === "agent_suggested"
              ? "suggested"
              : undefined
        }
      >
        {PLAYBOOK_CATEGORY_LABEL[entry.category] ?? entry.category}
      </CardPlacard>
      <View className="gap-3 p-4">
        {entry.title ? (
          <Text className="text-sm font-semibold text-content-primary">{entry.title}</Text>
        ) : null}
        {editing ? (
          <TextArea value={content} onChangeText={setContent} numberOfLines={4} />
        ) : (
          <Text className="text-sm leading-relaxed text-content-secondary">{entry.content}</Text>
        )}
        <View className="flex-row gap-2">
          {editing ? (
            <>
              <Button variant="ghost" size="sm" onPress={() => setEditing(false)}>
                Cancel
              </Button>
              <Button size="sm" loading={update.isPending} disabled={!content.trim()} onPress={() => void save()}>
                Save
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" onPress={() => setEditing(true)}>
                Edit
              </Button>
              <Button variant="ghost" size="sm" loading={deleting} onPress={onDelete}>
                Delete
              </Button>
            </>
          )}
        </View>
      </View>
    </Card>
  );
}
