"use client";

import { useState } from "react";
import {
  Button,
  Card,
  CardPlacard,
  EmptyState,
  Icon,
  Input,
  Select,
  Skeleton,
  TextArea,
  useToast,
} from "@inkd/ui/web";
import type { AgentPlaybook, PlaybookCategory } from "@inkd/core";
import {
  useCreatePlaybook,
  useDeletePlaybook,
  usePlaybooks,
  useUpdatePlaybook,
} from "@inkd/core/hooks";

import { PLAYBOOK_CATEGORY_LABEL } from "./meta";

const CATEGORY_OPTIONS = (
  Object.keys(PLAYBOOK_CATEGORY_LABEL) as PlaybookCategory[]
).map((value) => ({ value, label: PLAYBOOK_CATEGORY_LABEL[value] ?? value }));

interface DraftEntry {
  title: string;
  category: PlaybookCategory;
  content: string;
}

const EMPTY_DRAFT: DraftEntry = { title: "", category: "faq", content: "" };

/**
 * The playbook knowledge base editor. Each entry is a placard card; artists
 * add / edit / delete. The explainer copy is deliberately honest about the
 * boundary — the AI staff answer ONLY from these entries plus the artist's
 * published rates and hours, nothing invented.
 */
export function PlaybookEditor({ artistId }: { artistId: string }) {
  const { toast } = useToast();
  const listQ = usePlaybooks(artistId);
  const create = useCreatePlaybook(artistId);
  const update = useUpdatePlaybook(artistId);
  const del = useDeletePlaybook(artistId);

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<DraftEntry>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);

  const entries = listQ.data ?? [];

  async function handleCreate() {
    if (!draft.content.trim()) return;
    try {
      await create.mutateAsync({
        title: draft.title.trim() || null,
        category: draft.category,
        content: draft.content.trim(),
      });
      setDraft(EMPTY_DRAFT);
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
    <div className="flex flex-col gap-5" data-testid="playbook-editor">
      <div className="flex items-start gap-3 rounded-sm border border-border-subtle bg-surface-plate-ink/50 p-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-sm bg-surface-overlay text-content-accent">
          <Icon name="shield" size={17} />
        </span>
        <p className="text-sm leading-relaxed text-content-secondary">
          Your AI staff answer <strong className="text-content-primary">only</strong>{" "}
          from this playbook plus your published rates and hours. If it&rsquo;s not
          written here or in your settings, they won&rsquo;t make it up — they hand
          off to you instead. Keep this current and they stay accurate.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="font-sans text-sm font-semibold text-content-primary">
          Entries {entries.length > 0 && `(${entries.length})`}
        </h3>
        {!adding && (
          <Button hero onClick={() => setAdding(true)}>
            <Icon name="plus" size={16} />
            Add entry
          </Button>
        )}
      </div>

      {adding && (
        <Card padding="md" variant="raised" className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <Input
              placeholder="Title (optional) — e.g. Do you do cover-ups?"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
            <Select
              options={CATEGORY_OPTIONS}
              value={draft.category}
              onChange={(e) =>
                setDraft({ ...draft, category: e.target.value as PlaybookCategory })
              }
            />
          </div>
          <TextArea
            placeholder="What should your staff know or say? Write it the way you'd explain it to a client."
            rows={4}
            value={draft.content}
            onChange={(e) => setDraft({ ...draft, content: e.target.value })}
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setAdding(false);
                setDraft(EMPTY_DRAFT);
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              loading={create.isPending}
              disabled={!draft.content.trim()}
              onClick={() => void handleCreate()}
            >
              Save entry
            </Button>
          </div>
        </Card>
      )}

      {listQ.isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-sm" />
          ))}
        </div>
      ) : entries.length === 0 && !adding ? (
        <EmptyState
          className="py-10"
          icon={<Icon name="image" size={22} />}
          title="No playbook entries yet"
          description="Add your FAQs, tone, and policies so your staff can answer them for you."
        />
      ) : (
        <ul className="flex flex-col gap-2.5">
          {entries.map((entry) => (
            <PlaybookRow
              key={entry.id}
              entry={entry}
              editing={editingId === entry.id}
              onEdit={() => setEditingId(entry.id)}
              onCancel={() => setEditingId(null)}
              onSave={async (patch) => {
                try {
                  await update.mutateAsync({ id: entry.id, input: patch });
                  setEditingId(null);
                } catch (err) {
                  toast({
                    title: "Couldn't save",
                    description: err instanceof Error ? err.message : "Try again.",
                    variant: "danger",
                  });
                }
              }}
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
              saving={update.isPending}
              deleting={del.isPending}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function PlaybookRow({
  entry,
  editing,
  onEdit,
  onCancel,
  onSave,
  onDelete,
  saving,
  deleting,
}: {
  entry: AgentPlaybook;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (patch: { title: string | null; category: PlaybookCategory; content: string }) => void;
  onDelete: () => void;
  saving: boolean;
  deleting: boolean;
}) {
  const [title, setTitle] = useState(entry.title ?? "");
  const [category, setCategory] = useState<PlaybookCategory>(entry.category);
  const [content, setContent] = useState(entry.content);

  return (
    <li>
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
        <div className="flex flex-col gap-3 p-4">
          {editing ? (
            <>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (optional)" />
                <Select
                  options={CATEGORY_OPTIONS}
                  value={category}
                  onChange={(e) => setCategory(e.target.value as PlaybookCategory)}
                />
              </div>
              <TextArea rows={4} value={content} onChange={(e) => setContent(e.target.value)} />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={onCancel}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  loading={saving}
                  disabled={!content.trim()}
                  onClick={() =>
                    onSave({ title: title.trim() || null, category, content: content.trim() })
                  }
                >
                  Save
                </Button>
              </div>
            </>
          ) : (
            <>
              {entry.title && (
                <p className="text-sm font-semibold text-content-primary">
                  {entry.title}
                </p>
              )}
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-content-secondary">
                {entry.content}
              </p>
              <div className="flex items-center gap-3 pt-0.5">
                <Button variant="ghost" size="sm" onClick={onEdit}>
                  <Icon name="settings" size={14} />
                  Edit
                </Button>
                <Button variant="ghost" size="sm" loading={deleting} onClick={onDelete}>
                  <Icon name="x" size={14} />
                  Delete
                </Button>
              </div>
            </>
          )}
        </div>
      </Card>
    </li>
  );
}
