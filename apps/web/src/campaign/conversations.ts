import {
  archiveConversation,
  type CampaignHandles,
  type CampaignIndexDoc,
  renameConversation,
  restoreConversation,
} from "@archefict/crdt";
import type { Conversation } from "@archefict/schema";
import type { Doc } from "@automerge/automerge";
import { type Accessor, createMemo, createSignal } from "solid-js";

export const NEW_CONVERSATION_TITLE = "New conversation";

const STATE_PREFIX = "archefict:story:";

/** What the Story tab remembers between visits, per campaign, on this device. */
type StoryState = {
  activeId: string | null;
  listHidden: boolean;
};

export type ConversationStore = {
  open: Accessor<readonly Conversation[]>;
  archived: Accessor<readonly Conversation[]>;
  /** The conversation being played, or null when every one is archived. */
  active: Accessor<Conversation | null>;
  listHidden: Accessor<boolean>;
  select: (id: string) => void;
  /** Adds a conversation and opens it. */
  create: () => Promise<void>;
  rename: (id: string, title: string) => Promise<void>;
  archive: (id: string) => Promise<void>;
  /** Brings an archived conversation back and opens it. */
  restore: (id: string) => Promise<void>;
  toggleList: () => void;
};

/**
 * The Story tab's state: which conversation is open and whether the list shows. Both are
 * this device's business, like drafts and undo, so they live in localStorage by campaign
 * (ARCHITECTURE.md). The list itself is the index document, reactive through its signal.
 *
 * This is the tab state of docs/workspace.md: the list panel writes the active id, the
 * narrative panel reads it, and neither knows where the other sits.
 */
export function createConversationStore(
  handles: CampaignHandles,
  index: Accessor<Doc<CampaignIndexDoc>>,
): ConversationStore {
  const key = STATE_PREFIX + handles.index.url;
  const stored = readState(key);
  const [activeId, setActiveId] = createSignal<string | null>(stored.activeId);
  const [listHidden, setListHidden] = createSignal(stored.listHidden);

  const open = createMemo(() =>
    index().conversations.filter((conversation) => conversation.archivedAt === undefined),
  );
  const archived = createMemo(() =>
    index().conversations.filter((conversation) => conversation.archivedAt !== undefined),
  );
  // A remembered id that was archived, here or elsewhere, falls back to the first open one.
  const active = createMemo(
    () => open().find((conversation) => conversation.id === activeId()) ?? open()[0] ?? null,
  );

  function persist(): void {
    writeState(key, { activeId: activeId(), listHidden: listHidden() });
  }

  function select(id: string): void {
    setActiveId(id);
    persist();
  }

  return {
    open,
    archived,
    active,
    listHidden,
    select,
    async create() {
      const created = await handles.createConversation(NEW_CONVERSATION_TITLE);
      select(created.id);
    },
    async rename(id, title) {
      renameConversation(handles.index, id, title);
      await handles.flush();
    },
    async archive(id) {
      archiveConversation(handles.index, id);
      await handles.flush();
    },
    async restore(id) {
      restoreConversation(handles.index, id);
      select(id);
      await handles.flush();
    },
    toggleList() {
      setListHidden((hidden) => !hidden);
      persist();
    },
  };
}

function readState(key: string): StoryState {
  const fallback: StoryState = { activeId: null, listHidden: false };
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return fallback;
    const value = parsed as Partial<StoryState>;
    return {
      activeId: typeof value.activeId === "string" ? value.activeId : null,
      listHidden: value.listHidden === true,
    };
  } catch {
    return fallback;
  }
}

function writeState(key: string, state: StoryState): void {
  try {
    localStorage.setItem(key, JSON.stringify(state));
  } catch {
    // Storage blocked: the tab forgets its place when the page closes.
  }
}
