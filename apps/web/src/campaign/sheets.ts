import {
  archiveSheet,
  type CampaignHandles,
  type CampaignIndexDoc,
  createFolder,
  moveSheet,
  removeFolder,
  renameFolder,
  renameSheet,
  restoreSheet,
} from "@archefict/crdt";
import type { Folder, SheetSummary } from "@archefict/schema";
import type { Doc } from "@automerge/automerge";
import { type Accessor, createMemo, createSignal } from "solid-js";

export const NEW_SHEET_TITLE = "New sheet";
export const NEW_FOLDER_TITLE = "New folder";

const STATE_PREFIX = "archefict:library:";

/** What the Library tab remembers between visits, per campaign, on this device. */
type LibraryState = {
  activeId: string | null;
  expanded: string[];
};

export type SheetsStore = {
  folders: Accessor<readonly Folder[]>;
  /** Sheets that are not archived. */
  sheets: Accessor<readonly SheetSummary[]>;
  archived: Accessor<readonly SheetSummary[]>;
  /** The sheet being read or written, or null when none is open. */
  active: Accessor<SheetSummary | null>;
  expanded: Accessor<ReadonlySet<string>>;
  select: (id: string | null) => void;
  toggleFolder: (id: string) => void;
  /** Adds a sheet to a folder (null for the root), shows the folder, and opens the sheet. */
  createSheet: (folderId: string | null) => Promise<void>;
  createFolder: (parentId: string | null) => Promise<void>;
  renameSheet: (id: string, title: string) => Promise<void>;
  renameFolder: (id: string, title: string) => Promise<void>;
  /** False when the folder still holds something; nothing changes then. */
  removeFolder: (id: string) => Promise<boolean>;
  moveSheet: (id: string, folderId: string | null) => Promise<void>;
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

  const folders = createMemo(() => index().folders);
  const sheets = createMemo(() => index().sheets.filter((sheet) => sheet.archivedAt === undefined));
  const archived = createMemo(() =>
    index().sheets.filter((sheet) => sheet.archivedAt !== undefined),
  );
  // Unlike a conversation, a sheet has no natural default: nothing open shows the empty state.
  const active = createMemo(() => sheets().find((sheet) => sheet.id === activeId()) ?? null);

  function persist(): void {
    writeState(key, { activeId: activeId(), expanded: [...expanded()] });
  }

  function select(id: string | null): void {
    setActiveId(id);
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
    archived,
    active,
    expanded,
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
    async moveSheet(id, folderId) {
      moveSheet(handles.index, id, folderId);
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
  };
}

function readState(key: string): LibraryState {
  const fallback: LibraryState = { activeId: null, expanded: [] };
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
