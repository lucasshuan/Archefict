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
  type FieldMeta,
  type Folder,
  NarrativeEntry,
  type Provenance,
  type SheetKind,
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
  /** The fields, every value a string: what the AI reads first, and what Slice 4's components attach to. */
  fields: Record<string, string>;
  /**
   * What a field is, per key, when someone has said (docs/sheets.md). Optional and sparse: a
   * key without one is read as text, or inferred from its value. Beside the value, never in it.
   */
  meta?: Record<string, FieldMeta>;
};

export type CampaignIndexDoc = {
  name: string;
  createdAt: number;
  conversations: Conversation[];
  folders: Folder[];
  sheets: SheetSummary[];
  /** The narrator's instructions for this campaign. Absent: the device's default applies. */
  instructions?: string;
  /** The campaign's chosen picture. Absent: a placeholder is drawn wherever a cover is shown. */
  cover?: string;
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
  /**
   * Adds an empty sheet to a folder, or to the root with null. Durable before it returns. A
   * sheet takes the folder's models unless told otherwise; a model takes none.
   */
  createSheet: (
    title: string,
    folderId: string | null,
    options?: { kind?: SheetKind; models?: string[] },
  ) => Promise<SheetSummary>;
  /**
   * Copies a sheet — body, fields and models — and puts it directly after the original. The
   * document is cloned rather than read and rewritten, so marks and block structure survive.
   */
  duplicateSheet: (id: string) => Promise<SheetSummary>;
  /** Copies a conversation and its entries, directly after the original. */
  duplicateConversation: (id: string) => Promise<Conversation>;
  /**
   * Removes sheets and their documents for good. The records go first and are flushed before
   * the documents are dropped, so a crash in between leaves an unreachable document rather
   * than a record pointing at nothing. Nothing brings these back.
   */
  deleteSheets: (ids: readonly string[]) => Promise<void>;
  /** Removes conversations and their timelines for good. Nothing brings these back. */
  deleteConversations: (ids: readonly string[]) => Promise<void>;
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
    async createSheet(title, folderId, options = {}) {
      const doc = repo.create<SheetDoc>({ body: "", fields: {} });
      const current = index.doc();
      const handed =
        options.kind === "model"
          ? []
          : (options.models ??
            current.folders.find((folder) => folder.id === folderId)?.models ??
            []);
      const record: SheetSummary = {
        id: crypto.randomUUID(),
        title,
        folderId,
        order: current.sheets.filter((sheet) => sheet.folderId === folderId).length,
        docUrl: doc.url,
        createdAt: Date.now(),
        ...(options.kind === "model" ? { kind: "model" as const } : {}),
        ...(handed.length > 0 ? { models: [...handed] } : {}),
      };
      index.change((d) => {
        d.sheets.push(record);
      });
      await repo.flush([index.documentId, doc.documentId]);
      return record;
    },
    async duplicateSheet(id) {
      const source = index.doc().sheets.find((sheet) => sheet.id === id);
      if (source === undefined) throw new Error(`No sheet ${id} in this campaign`);
      if (!isValidAutomergeUrl(source.docUrl)) {
        throw new Error(`Sheet ${id} does not point at an Automerge URL`);
      }
      const doc = repo.clone(await repo.find<SheetDoc>(source.docUrl));
      const record: SheetSummary = {
        id: crypto.randomUUID(),
        title: copyTitle(
          source.title,
          index.doc().sheets.map((sheet) => sheet.title),
        ),
        folderId: source.folderId,
        order: source.order,
        docUrl: doc.url,
        createdAt: Date.now(),
        ...(source.kind === undefined ? {} : { kind: source.kind }),
        ...(source.models === undefined ? {} : { models: [...source.models] }),
      };
      index.change((d) => {
        d.sheets.push(record);
      });
      // Beside the one it came from, not at the end of the folder: a copy belongs next to
      // its original, which is where the eye already is.
      moveSheet(index, record.id, source.folderId, { id: source.id, side: "after" });
      await repo.flush([index.documentId, doc.documentId]);
      const placed = index.doc().sheets.find((sheet) => sheet.id === record.id);
      return placed === undefined ? record : { ...record, order: placed.order };
    },
    async duplicateConversation(id) {
      const source = index.doc().conversations.find((c) => c.id === id);
      if (source === undefined) throw new Error(`No conversation ${id} in this campaign`);
      if (!isValidAutomergeUrl(source.docUrl)) {
        throw new Error(`Conversation ${id} does not point at an Automerge URL`);
      }
      const timeline = repo.clone(await repo.find<TimelineDoc>(source.docUrl));
      const record: Conversation = {
        id: crypto.randomUUID(),
        title: copyTitle(
          source.title,
          index.doc().conversations.map((c) => c.title),
        ),
        docUrl: timeline.url,
        createdAt: Date.now(),
      };
      index.change((d) => {
        d.conversations.splice(d.conversations.findIndex((c) => c.id === id) + 1, 0, record);
      });
      await repo.flush([index.documentId, timeline.documentId]);
      return record;
    },
    async deleteSheets(ids) {
      const urls = index
        .doc()
        .sheets.filter((sheet) => ids.includes(sheet.id))
        .map((sheet) => sheet.docUrl);
      if (urls.length === 0) return;
      index.change((d) => {
        const gone = new Set(ids);
        for (let at = d.sheets.length - 1; at >= 0; at -= 1) {
          const sheet = d.sheets[at];
          if (sheet !== undefined && gone.has(sheet.id)) d.sheets.splice(at, 1);
        }
      });
      await repo.flush([index.documentId]);
      for (const url of urls) if (isValidAutomergeUrl(url)) repo.delete(url);
    },
    async deleteConversations(ids) {
      const urls = index
        .doc()
        .conversations.filter((c) => ids.includes(c.id))
        .map((c) => c.docUrl);
      if (urls.length === 0) return;
      index.change((d) => {
        const gone = new Set(ids);
        for (let at = d.conversations.length - 1; at >= 0; at -= 1) {
          const conversation = d.conversations[at];
          if (conversation !== undefined && gone.has(conversation.id)) {
            d.conversations.splice(at, 1);
          }
        }
      });
      await repo.flush([index.documentId]);
      for (const url of urls) if (isValidAutomergeUrl(url)) repo.delete(url);
    },
    flush: () => repo.flush([index.documentId]),
  };
}

/**
 * What a copy is called: "Varn" becomes "Varn copy", and "Varn copy 2" once the first one is
 * taken. Duplicating twice must not leave two rows reading the same word.
 */
function copyTitle(title: string, taken: readonly string[]): string {
  const base = `${title} copy`;
  if (!taken.includes(base)) return base;
  let n = 2;
  while (taken.includes(`${base} ${n}`)) n += 1;
  return `${base} ${n}`;
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

/**
 * The order siblings read in, everywhere: `order` first, then title. The tie-break is what a
 * merge needs — two peers can put two records in the same slot, and the list still has one
 * answer. The kernel and the tree share it, so a position named in the UI means the same here.
 */
export function bySiblingOrder<T extends { order: number; title: string }>(a: T, b: T): number {
  return a.order - b.order || a.title.localeCompare(b.title);
}

/** Where a moved sheet lands among the sheets already in a folder. */
export type Beside = { id: string; side: "before" | "after" };

/**
 * Moves a sheet into another folder, or to the root with null, and places it among the sheets
 * already there: beside one of them, or last when `beside` is null. The same folder and a
 * `beside` is a reorder.
 *
 * The destination is renumbered from zero so its slots stay dense; the folder left behind keeps
 * its gaps, because `order` only ever says who comes first. The position is named as a
 * neighbour rather than as an index because an archived sheet keeps its slot — it is hidden, not
 * gone — so what the tree shows and what the folder holds are not the same list.
 */
export function moveSheet(
  index: DocHandle<CampaignIndexDoc>,
  id: string,
  folderId: string | null,
  beside: Beside | null = null,
): void {
  const doc = index.doc();
  const moving = doc.sheets.find((s) => s.id === id);
  if (moving === undefined) return;
  if (beside !== null && beside.id === id) return;
  if (folderId !== null && !doc.folders.some((f) => f.id === folderId)) return;
  const siblings = doc.sheets
    .filter((s) => s.folderId === folderId && s.id !== id)
    .sort(bySiblingOrder);
  // A neighbour that is not in this folder names no position; the sheet goes last instead.
  const anchor = beside === null ? -1 : siblings.findIndex((s) => s.id === beside.id);
  const at = anchor < 0 ? siblings.length : anchor + (beside?.side === "after" ? 1 : 0);
  const placed = [...siblings.slice(0, at), moving, ...siblings.slice(at)];
  const settled =
    moving.folderId === folderId && placed.every((sheet, position) => sheet.order === position);
  if (settled) return;
  index.change((d) => {
    const target = d.sheets.find((s) => s.id === id);
    if (target) target.folderId = folderId;
    placed.forEach((sheet, position) => {
      const record = d.sheets.find((s) => s.id === sheet.id);
      if (record && record.order !== position) record.order = position;
    });
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

/**
 * The models a sheet takes, replaced whole and in order: the first to claim a key wins.
 * Taking or dropping a model writes nothing into the sheet's own fields — structure never
 * destroys content. Ids that name no model, or the sheet itself, are dropped here.
 */
export function setSheetModels(
  index: DocHandle<CampaignIndexDoc>,
  id: string,
  models: readonly string[],
): void {
  const current = index.doc();
  const valid = new Set(
    current.sheets.filter((s) => s.kind === "model" && s.id !== id).map((s) => s.id),
  );
  const next = [...new Set(models)].filter((model) => valid.has(model));
  const target = current.sheets.find((s) => s.id === id);
  if (!target || sameList(target.models ?? [], next)) return;
  index.change((doc) => {
    const sheet = doc.sheets.find((s) => s.id === id);
    if (!sheet) return;
    if (next.length === 0) delete sheet.models;
    else sheet.models = next;
  });
}

/** The models a folder hands to sheets created inside it. Existing sheets are not touched. */
export function setFolderModels(
  index: DocHandle<CampaignIndexDoc>,
  id: string,
  models: readonly string[],
): void {
  const current = index.doc();
  const valid = new Set(current.sheets.filter((s) => s.kind === "model").map((s) => s.id));
  const next = [...new Set(models)].filter((model) => valid.has(model));
  const target = current.folders.find((f) => f.id === id);
  if (!target || sameList(target.models ?? [], next)) return;
  index.change((doc) => {
    const folder = doc.folders.find((f) => f.id === id);
    if (!folder) return;
    if (next.length === 0) delete folder.models;
    else folder.models = next;
  });
}

function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((item, i) => item === b[i]);
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

/** Removes a field: its value and whatever was said about it. A formula has only the latter. */
export function removeSheetField(sheet: DocHandle<SheetDoc>, key: string): void {
  const current = sheet.doc();
  if (!(key in current.fields) && !(current.meta && key in current.meta)) return;
  sheet.change((doc) => {
    delete doc.fields[key];
    if (doc.meta) delete doc.meta[key];
  });
}

/**
 * Says what a field is — number with a unit, select with its options — or, with null, stops
 * saying it, so the field goes back to being read as text (or inferred from its value). The
 * whole description is replaced at once: two devices describing one field concurrently keep
 * one description, never a mixture. The value is not touched either way.
 */
export function setSheetFieldMeta(
  sheet: DocHandle<SheetDoc>,
  key: string,
  meta: FieldMeta | null,
): void {
  const trimmed = key.trim();
  if (trimmed === "") return;
  sheet.change((doc) => {
    if (meta === null) {
      if (doc.meta) delete doc.meta[trimmed];
      return;
    }
    if (!doc.meta) doc.meta = {};
    doc.meta[trimmed] = structuredClone(meta);
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
