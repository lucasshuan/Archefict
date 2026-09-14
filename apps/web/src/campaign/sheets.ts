import {
  archiveSheet,
  type Beside,
  type CampaignHandles,
  type CampaignIndexDoc,
  createFolder,
  moveSheet,
  removeFolder,
  renameFolder,
  renameSheet,
  restoreSheet,
  setSheetModels,
} from "@archefict/crdt";
import type { Folder, SheetSummary } from "@archefict/schema";
import type { Doc } from "@automerge/automerge";
import { type Accessor, createMemo, createSignal } from "solid-js";

export const NEW_SHEET_TITLE = "New sheet";
export const NEW_FOLDER_TITLE = "New folder";
export const NEW_MODEL_TITLE = "New model";

const STATE_PREFIX = "archefict:library:";

/** Which of the library's three lists the panel is showing (docs/workspace.md). */
export type LibraryTabId = "sheets" | "models" | "assets";

const LIBRARY_TABS: readonly LibraryTabId[] = ["sheets", "models", "assets"];

/** What the Library tab remembers between visits, per campaign, on this device. */
type LibraryState = {
  activeId: string | null;
  expanded: string[];
  tab: LibraryTabId;
};

export type SheetsStore = {
  folders: Accessor<readonly Folder[]>;
  /** Sheets that are not archived, models among them. */
  sheets: Accessor<readonly SheetSummary[]>;
  /** The sheets the tree draws: everything open that is not a model. */
  documents: Accessor<readonly SheetSummary[]>;
  archived: Accessor<readonly SheetSummary[]>;
  /** The models among the sheets that are not archived, by title (docs/sheets.md). */
  models: Accessor<readonly SheetSummary[]>;
  /** The sheet being read or written, or null when none is open. */
  active: Accessor<SheetSummary | null>;
  expanded: Accessor<ReadonlySet<string>>;
  /** Which list the panel is showing. Remembered per campaign, on this device. */
  tab: Accessor<LibraryTabId>;
  showTab: (tab: LibraryTabId) => void;
  select: (id: string | null) => void;
  toggleFolder: (id: string) => void;
  /** Adds a sheet to a folder (null for the root), shows the folder, and opens the sheet. */
  createSheet: (folderId: string | null) => Promise<void>;
  /** Adds a model: a sheet other sheets take their shape from. Opens it. */
  createModel: () => Promise<SheetSummary>;
  /** Copies a sheet — body, fields and models — beside the original, and opens the copy. */
  duplicateSheet: (id: string) => Promise<void>;
  /** Removes sheets and their documents for good. Nothing brings them back. */
  deleteSheets: (ids: readonly string[]) => Promise<void>;
  /** The models a sheet takes, in order. Replaced whole; nothing in the sheet is touched. */
  setSheetModels: (id: string, models: readonly string[]) => Promise<void>;
  createFolder: (parentId: string | null) => Promise<void>;
  renameSheet: (id: string, title: string) => Promise<void>;
  renameFolder: (id: string, title: string) => Promise<void>;
  /** False when the folder still holds something; nothing changes then. */
  removeFolder: (id: string) => Promise<boolean>;
  /**
   * Moves a sheet into a folder (null for the root) and places it there: beside a sheet
   * already in it, or last. The same folder and a `beside` is a reorder.
   */
  moveSheet: (id: string, folderId: string | null, beside?: Beside | null) => Promise<void>;
  archiveSheet: (id: string) => Promise<void>;
  /** Brings an archived sheet back and opens it. */
  restoreSheet: (id: string) => Promise<void>;
};

/**
 * The Library tab's state: which sheet is open and which folders are unfolded. Device-local,
 * like drafts and undo, in localStorage by campaign (ARCHITECTURE.md). The tree itself is the
 * index document, reactive through its signal. This is the tab state of docs/workspace.md:
 * the tree panel writes the active id, the sheet and fields panels read it.
 */
export function createSheetsStore(
  handles: CampaignHandles,
  index: Accessor<Doc<CampaignIndexDoc>>,
): SheetsStore {
  const key = STATE_PREFIX + handles.index.url;
  const stored = readState(key);
  const [activeId, setActiveId] = createSignal<string | null>(stored.activeId);
  const [expanded, setExpanded] = createSignal<ReadonlySet<string>>(new Set(stored.expanded));
  const [tab, setTab] = createSignal<LibraryTabId>(stored.tab);

  const folders = createMemo(() => index().folders);
  const sheets = createMemo(() => index().sheets.filter((sheet) => sheet.archivedAt === undefined));
  const archived = createMemo(() =>
    index().sheets.filter((sheet) => sheet.archivedAt !== undefined),
  );
  const documents = createMemo(() => sheets().filter((sheet) => sheet.kind !== "model"));
  // A flat list in a tab of its own (docs/workspace.md), so title order is the only order it
  // has: `order` reads against the folder a model happens to sit in, which nothing shows.
  const models = createMemo(() =>
    sheets()
      .filter((sheet) => sheet.kind === "model")
      .toSorted((a, b) => a.title.localeCompare(b.title)),
  );
  // Unlike a conversation, a sheet has no natural default: nothing open shows the empty state.
  const active = createMemo(() => sheets().find((sheet) => sheet.id === activeId()) ?? null);

  function persist(): void {
    writeState(key, { activeId: activeId(), expanded: [...expanded()], tab: tab() });
  }

  function select(id: string | null): void {
    setActiveId(id);
    // The panel follows what is open. A model lives in the models tab and a sheet in the tree,
    // so opening one while the other tab is showing would leave the panel pointing at a list
    // the open sheet is not in — the row you are reading should be the row you can see.
    // Closing one says nothing about which list to show, so nothing moves then.
    const opened = id === null ? null : sheets().find((sheet) => sheet.id === id);
    if (opened !== null && opened !== undefined) {
      setTab(opened.kind === "model" ? "models" : "sheets");
    }
    persist();
  }

  /** Unfolds a folder so something just put inside it is visible. The root needs nothing. */
  function reveal(folderId: string | null): void {
    if (folderId === null || expanded().has(folderId)) return;
    setExpanded((set) => new Set([...set, folderId]));
    persist();
  }

  return {
    folders,
    sheets,
    documents,
    archived,
    models,
    active,
    expanded,
    tab,
    showTab(next) {
      setTab(next);
      persist();
    },
    select,
    toggleFolder(id) {
      setExpanded((set) => {
        const next = new Set(set);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      persist();
    },
    async createSheet(folderId) {
      const created = await handles.createSheet(NEW_SHEET_TITLE, folderId);
      reveal(folderId);
      select(created.id);
    },
    async createFolder(parentId) {
      createFolder(handles.index, NEW_FOLDER_TITLE, parentId);
      reveal(parentId);
      await handles.flush();
    },
    async renameSheet(id, title) {
      renameSheet(handles.index, id, title);
      await handles.flush();
    },
    async renameFolder(id, title) {
      renameFolder(handles.index, id, title);
      await handles.flush();
    },
    async removeFolder(id) {
      const removed = removeFolder(handles.index, id);
      if (removed) await handles.flush();
      return removed;
    },
    async moveSheet(id, folderId, beside = null) {
      moveSheet(handles.index, id, folderId, beside);
      reveal(folderId);
      await handles.flush();
    },
    async archiveSheet(id) {
      archiveSheet(handles.index, id);
      await handles.flush();
    },
    async restoreSheet(id) {
      restoreSheet(handles.index, id);
      select(id);
      await handles.flush();
    },
    async createModel() {
      // At the root, never in a folder: models are listed flat in their own tab, so a folder
      // would be a place nothing shows and nothing could get them out of again.
      const created = await handles.createSheet(NEW_MODEL_TITLE, null, { kind: "model" });
      select(created.id);
      return created;
    },
    async duplicateSheet(id) {
      const copy = await handles.duplicateSheet(id);
      reveal(copy.folderId);
      select(copy.id);
    },
    async deleteSheets(ids) {
      await handles.deleteSheets(ids);
      // The open sheet may have been one of them; the tab falls back to its empty state.
      if (ids.includes(activeId() ?? "")) select(null);
    },
    async setSheetModels(id, taken) {
      setSheetModels(handles.index, id, taken);
      await handles.flush();
    },
  };
}

function readState(key: string): LibraryState {
  const fallback: LibraryState = { activeId: null, expanded: [], tab: "sheets" };
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return fallback;
    const value = parsed as Partial<LibraryState>;
    return {
      activeId: typeof value.activeId === "string" ? value.activeId : null,
      expanded: Array.isArray(value.expanded)
        ? value.expanded.filter((id): id is string => typeof id === "string")
        : [],
      tab: LIBRARY_TABS.find((candidate) => candidate === value.tab) ?? "sheets",
    };
  } catch {
    return fallback;
  }
}

function writeState(key: string, state: LibraryState): void {
  try {
    localStorage.setItem(key, JSON.stringify(state));
  } catch {
    // Storage blocked: the tab forgets its place when the page closes.
  }
}
