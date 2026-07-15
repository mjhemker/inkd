"use client";

/**
 * Dev-only preview harness for chat image attachments (Composer upload
 * states + MessageBubble attachment rendering). Renders the REAL `Composer`
 * and `MessageBubble` components from `../../../components/messages` against
 * a mock Supabase client (`mockChatClient.ts`) instead of the live
 * `khlpidflnvkqafkvkpfy.supabase.co` project, because this sandbox's egress
 * policy blocks that host for browser requests here.
 *
 * The mock's `behaviorFor` maps picked filenames to deterministic upload
 * timing/outcomes so this harness can drive the real upload code path into
 * every visible state (uploading / done / error) instead of faking the CSS.
 *
 * Never linked from product nav. Not for production use.
 */
import { InkdProvider } from "@inkd/core/hooks";
import type { ChatAttachment } from "@inkd/core";
import type { Message } from "@inkd/core/types";
import { Composer } from "../../../components/messages/Composer";
import { MessageBubble } from "../../../components/messages/MessageBubble";
import { createMockChatClient } from "./mockChatClient";

// Fixture files (see /tmp/chat-attach-fixtures in the screenshot script) are
// sized distinctly since the real upload path never carries the original
// filename — see mockChatClient.ts's `createMockChatClient` doc comment.
const mockClient = createMockChatClient((byteSize) => {
  if (byteSize > 100_000) return { fail: true }; // large "bad-photo.png"
  if (byteSize > 500) return { delayMs: 30_000 }; // medium "slow-photo.png"
  return { delayMs: 500 }; // tiny "done-photo.png"
});

function attachment(path: string, width = 1200, height = 900): ChatAttachment {
  return { path, kind: "image", width, height };
}

// Fixed (not `Date.now()`) so server- and client-rendered output match —
// this page is statically seeded demo data, not live state.
const DEMO_TIME = "2026-07-15T19:32:00.000Z";
let fixtureCounter = 0;

function makeMessage(overrides: Partial<Message>): Message {
  const now = DEMO_TIME;
  return {
    id: overrides.id ?? `m-fixture-${fixtureCounter++}`,
    thread_id: "thread-demo",
    sender_kind: "client",
    sender_profile_id: "profile-demo",
    agent_action_id: null,
    body: null,
    attachments: [] as unknown as Message["attachments"],
    drafted_by_agent: false,
    is_read: true,
    read_at: now,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

const bubbleFixtures: { label: string; isMine: boolean; message: Message }[] = [
  {
    label: "Text only — mine (client)",
    isMine: true,
    message: makeMessage({
      sender_kind: "client",
      body: "Hey! Are you around for a touch-up sometime next week?",
    }),
  },
  {
    label: "Text only — theirs (artist)",
    isMine: false,
    message: makeMessage({
      sender_kind: "artist",
      body: "Yep, I've got Thursday afternoon open — want me to hold 2pm?",
    }),
  },
  {
    label: "One image + caption — mine",
    isMine: true,
    message: makeMessage({
      sender_kind: "client",
      body: "Here's the reference I mentioned",
      attachments: [attachment("chat/thread-demo/profile-demo/ref-1.jpg")] as unknown as Message["attachments"],
    }),
  },
  {
    label: "Two images, no caption — theirs",
    isMine: false,
    message: makeMessage({
      sender_kind: "artist",
      body: null,
      attachments: [
        attachment("chat/thread-demo/artist-demo/healed-1.jpg"),
        attachment("chat/thread-demo/artist-demo/healed-2.jpg", 900, 1200),
      ] as unknown as Message["attachments"],
    }),
  },
  {
    label: "Agent-authored (Front Desk)",
    isMine: false,
    message: makeMessage({
      sender_kind: "agent",
      body: "Thanks for reaching out! Jayden's books are open through August — want me to share available slots?",
    }),
  },
  {
    label: "Human-sent, AI-drafted",
    isMine: false,
    message: makeMessage({
      sender_kind: "artist",
      drafted_by_agent: true,
      body: "Confirmed — see you Thursday at 2pm. Bring a valid photo ID for the waiver.",
    }),
  },
];

export default function MessagesAttachmentsPreviewPage() {
  return (
    <InkdProvider client={mockClient}>
      <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-10 px-5 py-12">
        <header className="flex flex-col gap-2">
          <span className="w-fit rounded-full border border-border-subtle bg-surface-overlay px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-content-muted">
            Internal · not for production
          </span>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">
            Chat attachments preview
          </h1>
          <p className="text-content-secondary">
            Composer upload states and message-bubble attachment rendering,
            driven against a mock storage client. Pick a file whose name
            starts with &quot;bad&quot; to force an upload error, or
            &quot;slow&quot; to see the in-flight spinner.
          </p>
        </header>

        <section className="flex flex-col gap-3" data-testid="composer-empty-section">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-content-muted">
            Composer — empty
          </h2>
          <div className="overflow-hidden rounded-xl border border-border-subtle">
            <Composer
              threadId="thread-demo"
              senderId="profile-demo"
              onSend={() => {}}
              disabled={false}
            />
          </div>
        </section>

        <section className="flex flex-col gap-3" data-testid="composer-loaded-section">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-content-muted">
            Composer — attaching photos
          </h2>
          <div className="overflow-hidden rounded-xl border border-border-subtle">
            <Composer
              threadId="thread-demo"
              senderId="profile-demo"
              onSend={() => {}}
              disabled={false}
            />
          </div>
        </section>

        <section className="flex flex-col gap-6" data-testid="bubbles-section">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-content-muted">
            Message bubbles
          </h2>
          {bubbleFixtures.map((fixture) => (
            <div key={fixture.label} className="flex flex-col gap-2">
              <p className="font-mono text-[10px] uppercase tracking-widest text-content-muted">
                {fixture.label}
              </p>
              <div className="rounded-xl border border-border-subtle bg-surface-base p-4">
                <MessageBubble message={fixture.message} isMine={fixture.isMine} />
              </div>
            </div>
          ))}
        </section>
      </div>
    </InkdProvider>
  );
}
