/**
 * @archefict/crdt
 *
 * Automerge document shapes and the operations that touch them.
 * Automerge is canonical; everything else is a projection (docs/stack.md).
 *
 * Document granularity (never one document per campaign):
 *   campaign-index     -> name, instructions, conversations, folders, sheets
 *   conversation:<id>  -> one conversation's timeline of narrative entries
 *   sheet:<id>         -> one sheet's body (rich text) and fields
 *
 * A conversation is a record in the index; its entries are a document of their own, so a
 * long one never weighs on the others and undo history stays per conversation. The entries
 * document and its operations keep their Timeline names: it is the timeline of that
 * conversation.
 *
 * Undo: Automerge has no application undo, so every timeline mutation returns the
 * TimelineAction that produced it. The caller keeps the stack; `undoAction` and `redoAction`
 * apply the inverse here, as ordinary changes, so undoing stays mergeable and syncs like any
 * edit. Index changes — conversations, instructions — are not undoable; archive is reversible
 * instead.
 *
 * This package knows nothing about the browser or Solid. Adapters are injected by the app.
 */
import {
  type Conversation,
  type Folder,
  NarrativeEntry,
  type Provenance,
  type SheetSummary,
  type TimelineAction,
} from "@archefict/schema";
import { updateText } from "@automerge/automerge";
import type { AutomergeUrl, DocHandle, Repo } from "@automerge/automerge-repo";
import { isValidAutomergeUrl } from "@automerge/automerge-repo";

export type TimelineDoc = {
  entries: NarrativeEntry[];
};

export type SheetDoc = {
  /** Rich text in Automerge's rich-text schema; ProseMirror edits it through @automerge/prosemirror. */
  body: string;
  /** The structured half: what the AI reads first, and what Slice 4's components attach to. */
  fields: Record<string, string>;
};

export type CampaignIndexDoc = {
  name: string;
  createdAt: number;
  conversations: Conversation[];
  folders: Folder[];
  sheets: SheetSummary[];
  /** The narrator's instructions for this campaign. Absent: the device's default applies. */
  instructions?: string;
  /** Slice 0 kept one feed per campaign here. `openCampaign` folds it into `conversations`. */
  timelineUrl?: AutomergeUrl;
};

/** The first conversation of every campaign, and the name a Slice 0 feed takes when migrated. */
export const FIRST_CONVERSATION_TITLE = "Story";

export type ConversationHandles = {
  id: string;
  timeline: DocHandle<TimelineDoc>;
  /**
   * Resolves once every pending change to the entries has reached storage. The Repo saves
   * on a debounce, so a change is not durable until this settles. Call it after every
   * user-visible write; a reload inside the debounce window loses data.
   */
  flush: () => Promise<void>;
};

export type SheetHandles = {
  id: string;
  doc: DocHandle<SheetDoc>;
  /** Resolves once pending changes to the sheet have reached storage. */
  flush: () => Promise<void>;
};

export type CampaignHandles = {
  index: DocHandle<CampaignIndexDoc>;
  /** Opens the entries of a conversation listed in the index. */
  openConversation: (id: string) => Promise<ConversationHandles>;
  /** Adds a conversation with an empty timeline. Durable before it returns. */
  createConversation: (title: string) => Promise<Conversation>;
  /** Opens the body and fields of a sheet listed in the index. */
  openSheet: (id: string) => Promise<SheetHandles>;
  /** Adds an empty sheet to a folder, or to the root with null. Durable before it returns. */
  createSheet: (title: string, folderId: string | null) => Promise<SheetSummary>;
  /** Resolves once pending changes to the index have reached storage. */
  flush: () => Promise<void>;
};

export function createCampaign(repo: Repo, name: string): CampaignHandles {
  const first = newConversation(repo, FIRST_CONVERSATION_TITLE);
  const index = repo.create<CampaignIndexDoc>({
    name,
    createdAt: Date.now(),
    conversations: [first.record],
    folders: [],
    sheets: [],
  });
  return handlesFor(repo, index);
}

export async function openCampaign(repo: Repo, indexUrl: string): Promise<CampaignHandles> {
  if (!isValidAutomergeUrl(indexUrl)) {
    throw new Error(`Not an Automerge URL: ${indexUrl}`);
  }
  const index = await repo.find<CampaignIndexDoc>(indexUrl);
  migrateIndex(index);
  return handlesFor(repo, index);
}

/**
 * Removes every document of a campaign. Returns the conversations that were listed, so the
 * caller can drop what it kept beside them on the device (drafts, undo history).
 */
export function deleteCampaign(
  repo: Repo,
  index: DocHandle<CampaignIndexDoc>,
): readonly Conversation[] {
  const conversations = [...index.doc().conversations];
  for (const conversation of conversations) {
    if (isValidAutomergeUrl(conversation.docUrl)) repo.delete(conversation.docUrl);
  }
  for (const sheet of index.doc().sheets) {
    if (isValidAutomergeUrl(sheet.docUrl)) repo.delete(sheet.docUrl);
  }
  repo.delete(index.documentId);
  return conversations;
}

function handlesFor(repo: Repo, index: DocHandle<CampaignIndexDoc>): CampaignHandles {
  return {
    index,
    async openConversation(id) {
      const record = index.doc().conversations.find((c) => c.id === id);
      if (record === undefined) throw new Error(`No conversation ${id} in this campaign`);
      if (!isValidAutomergeUrl(record.docUrl)) {
        throw new Error(`Conversation ${id} does not point at an Automerge URL`);
      }
      const timeline = await repo.find<TimelineDoc>(record.docUrl);
      return { id, timeline, flush: () => repo.flush([timeline.documentId]) };
    },
    async createConversation(title) {
      const { record, timeline } = newConversation(repo, title);
      index.change((doc) => {
        doc.conversations.push(record);
      });
      await repo.flush([index.documentId, timeline.documentId]);
      return record;
    },
    async openSheet(id) {
      const record = index.doc().sheets.find((sheet) => sheet.id === id);
      if (record === undefined) throw new Error(`No sheet ${id} in this campaign`);
      if (!isValidAutomergeUrl(record.docUrl)) {
        throw new Error(`Sheet ${id} does not point at an Automerge URL`);
      }
      const doc = await repo.find<SheetDoc>(record.docUrl);
      return { id, doc, flush: () => repo.flush([doc.documentId]) };
    },
    async createSheet(title, folderId) {
      const doc = repo.create<SheetDoc>({ body: "", fields: {} });
      const record: SheetSummary = {
        id: crypto.randomUUID(),
        title,
        folderId,
        order: index.doc().sheets.filter((sheet) => sheet.folderId === folderId).length,
        docUrl: doc.url,
        createdAt: Date.now(),
      };
      index.change((d) => {
        d.sheets.push(record);
      });
      await repo.flush([index.documentId, doc.documentId]);
      return record;
    },
    flush: () => repo.flush([index.documentId]),
  };
}

function newConversation(
  repo: Repo,
  title: string,
): { record: Conversation; timeline: DocHandle<TimelineDoc> } {
  const timeline = repo.create<TimelineDoc>({ entries: [] });
  return {
    record: { id: crypto.randomUUID(), title, docUrl: timeline.url, createdAt: Date.now() },
    timeline,
  };
}

/**
 * A Slice 0 campaign had one feed, pointed at by `timelineUrl`. It becomes the first
 * conversation and keeps its document, so nothing written before this shape existed moves.
 */
function migrateIndex(index: DocHandle<CampaignIndexDoc>): void {
  const current = index.doc() as Partial<CampaignIndexDoc>;
  const needsConversations = current.conversations === undefined;
  const needsLibrary = current.folders === undefined || current.sheets === undefined;
  if (!needsConversations && !needsLibrary) return;
  index.change((doc) => {
    if (needsConversations) {
      const legacy = doc.timelineUrl;
      doc.conversations = legacy
        ? [
            {
              id: crypto.randomUUID(),
              title: FIRST_CONVERSATION_TITLE,
              docUrl: legacy,
              createdAt: doc.createdAt,
            },
          ]
        : [];
      delete doc.timelineUrl;
    }
    // The library arrived after the first campaigns: an index without one gets empty shelves.
    if (doc.folders === undefined) doc.folders = [];
    if (doc.sheets === undefined) doc.sheets = [];
  });
}

export function renameCampaign(index: DocHandle<CampaignIndexDoc>, name: string): void {
  const trimmed = name.trim();
  if (trimmed === "" || trimmed === index.doc().name) return;
  index.change((doc) => {
    doc.name = trimmed;
  });
}

// ---------------------------------------------------------------------------
// Conversations. Records in the index; each points at its own entries document.
// ---------------------------------------------------------------------------

export function conversationsOf(index: DocHandle<CampaignIndexDoc>): readonly Conversation[] {
  return index.doc().conversations;
}

export function renameConversation(
  index: DocHandle<CampaignIndexDoc>,
  id: string,
  title: string,
): void {
  const trimmed = title.trim();
  if (trimmed === "") return;
  const current = index.doc().conversations.find((c) => c.id === id);
  if (current === undefined || current.title === trimmed) return;
  index.change((doc) => {
    const target = doc.conversations.find((c) => c.id === id);
    if (target) target.title = trimmed;
  });
}

/** Puts a conversation away. Nothing is lost: `restoreConversation` brings it back as it was. */
export function archiveConversation(index: DocHandle<CampaignIndexDoc>, id: string): void {
  const current = index.doc().conversations.find((c) => c.id === id);
  if (current === undefined || current.archivedAt !== undefined) return;
  index.change((doc) => {
    const target = doc.conversations.find((c) => c.id === id);
    if (target) target.archivedAt = Date.now();
  });
}

export function restoreConversation(index: DocHandle<CampaignIndexDoc>, id: string): void {
  const current = index.doc().conversations.find((c) => c.id === id);
  if (current === undefined || current.archivedAt === undefined) return;
  index.change((doc) => {
    const target = doc.conversations.find((c) => c.id === id);
    if (target) delete target.archivedAt;
  });
}

// ---------------------------------------------------------------------------
// Library. Folders and sheet records live in the index; a sheet's content is its own document.
// ---------------------------------------------------------------------------

export function foldersOf(index: DocHandle<CampaignIndexDoc>): readonly Folder[] {
  return index.doc().folders;
}

export function sheetsOf(index: DocHandle<CampaignIndexDoc>): readonly SheetSummary[] {
  return index.doc().sheets;
}

export function createFolder(
  index: DocHandle<CampaignIndexDoc>,
  title: string,
  parentId: string | null,
): Folder {
  const folder: Folder = {
    id: crypto.randomUUID(),
    title,
    parentId,
    order: index.doc().folders.filter((f) => f.parentId === parentId).length,
  };
  index.change((doc) => {
    doc.folders.push(folder);
  });
  return folder;
}

export function renameFolder(index: DocHandle<CampaignIndexDoc>, id: string, title: string): void {
  const trimmed = title.trim();
  if (trimmed === "") return;
  const current = index.doc().folders.find((f) => f.id === id);
  if (current === undefined || current.title === trimmed) return;
  index.change((doc) => {
    const target = doc.folders.find((f) => f.id === id);
    if (target) target.title = trimmed;
  });
}

/** Removes an empty folder. Returns false, and changes nothing, while anything is still in it. */
export function removeFolder(index: DocHandle<CampaignIndexDoc>, id: string): boolean {
  const doc = index.doc();
  const at = doc.folders.findIndex((f) => f.id === id);
  if (at < 0) return false;
  const occupied =
    doc.folders.some((f) => f.parentId === id) || doc.sheets.some((s) => s.folderId === id);
  if (occupied) return false;
  index.change((d) => {
    d.folders.splice(at, 1);
  });
  return true;
}

export function renameSheet(index: DocHandle<CampaignIndexDoc>, id: string, title: string): void {
  const trimmed = title.trim();
  if (trimmed === "") return;
  const current = index.doc().sheets.find((s) => s.id === id);
  if (current === undefined || current.title === trimmed) return;
  index.change((doc) => {
    const target = doc.sheets.find((s) => s.id === id);
    if (target) target.title = trimmed;
  });
}

/** Moves a sheet into another folder, or to the root with null, appending it there. */
export function moveSheet(
  index: DocHandle<CampaignIndexDoc>,
  id: string,
  folderId: string | null,
): void {
  const current = index.doc().sheets.find((s) => s.id === id);
  if (current === undefined || current.folderId === folderId) return;
  const order = index.doc().sheets.filter((s) => s.folderId === folderId).length;
  index.change((doc) => {
    const target = doc.sheets.find((s) => s.id === id);
    if (target) {
      target.folderId = folderId;
      target.order = order;
    }
  });
}

export function archiveSheet(index: DocHandle<CampaignIndexDoc>, id: string): void {
  const current = index.doc().sheets.find((s) => s.id === id);
  if (current === undefined || current.archivedAt !== undefined) return;
  index.change((doc) => {
    const target = doc.sheets.find((s) => s.id === id);
    if (target) target.archivedAt = Date.now();
  });
}

export function restoreSheet(index: DocHandle<CampaignIndexDoc>, id: string): void {
  const current = index.doc().sheets.find((s) => s.id === id);
  if (current === undefined || current.archivedAt === undefined) return;
  index.change((doc) => {
    const target = doc.sheets.find((s) => s.id === id);
    if (target) delete target.archivedAt;
  });
}

/** Sets one field. A text diff when it exists already, so two devices editing one value merge. */
export function setSheetField(sheet: DocHandle<SheetDoc>, key: string, value: string): void {
  const trimmed = key.trim();
  if (trimmed === "" || sheet.doc().fields[trimmed] === value) return;
  sheet.change((doc) => {
    if (typeof doc.fields[trimmed] === "string") updateText(doc, ["fields", trimmed], value);
    else doc.fields[trimmed] = value;
  });
}

export function removeSheetField(sheet: DocHandle<SheetDoc>, key: string): void {
  if (!(key in sheet.doc().fields)) return;
  sheet.change((doc) => {
    delete doc.fields[key];
  });
}

/**
 * The campaign's own narrator instructions. `undefined` returns the campaign to the device
 * default; a string, even an empty one, is exactly what the narrator gets. Written as a text
 * diff so two devices editing the same paragraph merge instead of one losing everything.
 */
export function setInstructions(
  index: DocHandle<CampaignIndexDoc>,
  text: string | undefined,
): void {
  if (index.doc().instructions === text) return;
  index.change((doc) => {
    if (text === undefined) {
      delete doc.instructions;
    } else if (typeof doc.instructions === "string") {
      updateText(doc, ["instructions"], text);
    } else {
      doc.instructions = text;
    }
  });
}

// ---------------------------------------------------------------------------
// Entries.
// ---------------------------------------------------------------------------

export type NewEntry = {
  kind: NarrativeEntry["kind"];
  text: string;
  provenance: Provenance;
};

export function createEntry(input: NewEntry): NarrativeEntry {
  return {
    id: crypto.randomUUID(),
    kind: input.kind,
    text: input.text,
    createdAt: Date.now(),
    provenance: input.provenance,
  };
}

export function entriesOf(timeline: DocHandle<TimelineDoc>): readonly NarrativeEntry[] {
  return timeline.doc().entries;
}

// ---------------------------------------------------------------------------
// Mutations. Each returns the action it performed, or null when nothing changed.
// ---------------------------------------------------------------------------

export function appendEntry(
  timeline: DocHandle<TimelineDoc>,
  entry: NarrativeEntry,
): TimelineAction | null {
  return appendEntries(timeline, [entry]);
}

/** Several entries in one change: one history step, and one undo. */
export function appendEntries(
  timeline: DocHandle<TimelineDoc>,
  entries: readonly NarrativeEntry[],
): TimelineAction | null {
  if (entries.length === 0) return null;
  const kept = entries.map(snapshot);
  timeline.change((doc) => {
    for (const entry of kept) doc.entries.push(snapshot(entry));
  });
  return { type: "append", entries: kept };
}

/**
 * Rewrites an entry's text as a minimal text diff, so concurrent edits to the same entry
 * merge character by character instead of one side losing everything.
 */
export function updateEntry(
  timeline: DocHandle<TimelineDoc>,
  id: string,
  text: string,
): TimelineAction | null {
  const entries = timeline.doc().entries;
  const index = entries.findIndex((entry) => entry.id === id);
  const current = entries[index];
  if (current === undefined || current.text === text) return null;

  const before = current.text;
  const beforeEditedAt = current.editedAt;
  const afterEditedAt = Date.now();
  writeText(timeline, index, text, afterEditedAt);

  return {
    type: "update",
    id,
    before,
    after: text,
    afterEditedAt,
    ...(beforeEditedAt !== undefined ? { beforeEditedAt } : {}),
  };
}

export function deleteEntry(timeline: DocHandle<TimelineDoc>, id: string): TimelineAction | null {
  const entries = timeline.doc().entries;
  const index = entries.findIndex((entry) => entry.id === id);
  const target = entries[index];
  if (target === undefined) return null;

  const action: TimelineAction = {
    type: "delete",
    entry: snapshot(target),
    afterId: entries[index - 1]?.id ?? null,
    index,
  };
  timeline.change((doc) => {
    doc.entries.splice(index, 1);
  });
  return action;
}

// ---------------------------------------------------------------------------
// Undo and redo.
// ---------------------------------------------------------------------------

/**
 * Applies the inverse of an action. Returns false when the timeline has moved past it (the
 * entry is already gone, or already back), so the caller can drop a stale step instead of
 * writing something that no longer makes sense.
 */
export function undoAction(timeline: DocHandle<TimelineDoc>, action: TimelineAction): boolean {
  switch (action.type) {
    case "append":
      return removeIds(
        timeline,
        action.entries.map((entry) => entry.id),
      );
    case "update":
      return setEntryText(timeline, action.id, action.before, action.beforeEditedAt);
    case "delete":
      return insertEntry(timeline, action.entry, action.afterId, action.index);
  }
}

/** Applies an action again after it was undone. Same contract as `undoAction`. */
export function redoAction(timeline: DocHandle<TimelineDoc>, action: TimelineAction): boolean {
  switch (action.type) {
    case "append":
      return restoreAppended(timeline, action.entries);
    case "update":
      return setEntryText(timeline, action.id, action.after, action.afterEditedAt);
    case "delete":
      return removeIds(timeline, [action.entry.id]);
  }
}

// ---------------------------------------------------------------------------

/**
 * A fresh, plain, validated copy. Automerge hands back frozen values, and the history has
 * to own objects it can keep, serialize and insert again later.
 */
function snapshot(entry: NarrativeEntry): NarrativeEntry {
  return NarrativeEntry.parse(entry);
}

function writeText(
  timeline: DocHandle<TimelineDoc>,
  index: number,
  text: string,
  editedAt: number | undefined,
): void {
  timeline.change((doc) => {
    updateText(doc, ["entries", index, "text"], text);
    const entry = doc.entries[index];
    if (entry === undefined) return;
    if (editedAt === undefined) delete entry.editedAt;
    else entry.editedAt = editedAt;
  });
}

function setEntryText(
  timeline: DocHandle<TimelineDoc>,
  id: string,
  text: string,
  editedAt: number | undefined,
): boolean {
  const index = timeline.doc().entries.findIndex((entry) => entry.id === id);
  if (index < 0) return false;
  writeText(timeline, index, text, editedAt);
  return true;
}

function removeIds(timeline: DocHandle<TimelineDoc>, ids: readonly string[]): boolean {
  const wanted = new Set(ids);
  if (!timeline.doc().entries.some((entry) => wanted.has(entry.id))) return false;
  timeline.change((doc) => {
    for (let i = doc.entries.length - 1; i >= 0; i--) {
      const entry = doc.entries[i];
      if (entry !== undefined && wanted.has(entry.id)) doc.entries.splice(i, 1);
    }
  });
  return true;
}

function restoreAppended(
  timeline: DocHandle<TimelineDoc>,
  entries: readonly NarrativeEntry[],
): boolean {
  const present = new Set(timeline.doc().entries.map((entry) => entry.id));
  const missing = entries.filter((entry) => !present.has(entry.id));
  if (missing.length === 0) return false;
  timeline.change((doc) => {
    for (const entry of missing) doc.entries.push(snapshot(entry));
  });
  return true;
}

function insertEntry(
  timeline: DocHandle<TimelineDoc>,
  entry: NarrativeEntry,
  afterId: string | null,
  index: number,
): boolean {
  const entries = timeline.doc().entries;
  if (entries.some((existing) => existing.id === entry.id)) return false;

  // Prefer the neighbour it followed: entries added since then would make the index wrong.
  let at = index;
  if (afterId === null) {
    at = 0;
  } else {
    const previous = entries.findIndex((existing) => existing.id === afterId);
    if (previous >= 0) at = previous + 1;
  }
  at = Math.min(Math.max(at, 0), entries.length);

  const copy = snapshot(entry);
  timeline.change((doc) => {
    doc.entries.splice(at, 0, copy);
  });
  return true;
}
