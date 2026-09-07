import {
  appendEntries,
  type CampaignHandles,
  deleteEntry,
  redoAction,
  undoAction,
  updateEntry,
} from "@archefict/crdt";
import { type NarrativeEntry, type TimelineAction, TimelineHistory } from "@archefict/schema";
import { type Accessor, createSignal } from "solid-js";

export type SaveState = "idle" | "saving" | "saved" | "failed";

/** How many timeline actions can be taken back. The oldest fall off the end. */
export const HISTORY_LIMIT = 50;

const HISTORY_PREFIX = "archefict:history:";

export type TimelineController = {
  /** Whether the last write reached storage. "saved" is the only durable state. */
  saveState: Accessor<SaveState>;
  /** Set when a write could not be persisted. AI failures are the turn runner's business. */
  error: Accessor<string | null>;
  canUndo: Accessor<boolean>;
  canRedo: Accessor<boolean>;
  append: (entries: readonly NarrativeEntry[]) => Promise<void>;
  /** Rewrite one entry. Any entry, the AI's included: the timeline is the player's. */
  update: (id: string, text: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
};

/**
 * The single write path into a campaign's timeline: every change goes through here, is
 * pushed onto the undo stack, and is flushed to storage.
 *
 * History is local to this device and this browser, like drafts and settings, because undo
 * belongs to the person who did the thing, not to the document (ARCHITECTURE.md). It is
 * kept as inverse actions rather than document snapshots, so undo is an ordinary edit that
 * merges and syncs like any other.
 */
export function createTimelineController(handles: CampaignHandles): TimelineController {
  const key = HISTORY_PREFIX + handles.timeline.url;
  const stored = readHistory(key);
  const [undoStack, setUndoStack] = createSignal<readonly TimelineAction[]>(stored.undo);
  const [redoStack, setRedoStack] = createSignal<readonly TimelineAction[]>(stored.redo);
  const [saveState, setSaveState] = createSignal<SaveState>("idle");
  const [error, setError] = createSignal<string | null>(null);

  function remember(undo: readonly TimelineAction[], redo: readonly TimelineAction[]): void {
    setUndoStack(undo);
    setRedoStack(redo);
    writeHistory(key, { version: 1, undo: [...undo], redo: [...redo] });
  }

  async function persist(): Promise<void> {
    setSaveState("saving");
    try {
      await handles.flush();
      setSaveState("saved");
      setError(null);
    } catch (caught) {
      setSaveState("failed");
      setError(`Could not save to local storage: ${describe(caught)}`);
    }
  }

  /** A fresh action always invalidates the redo branch, as in every editor. */
  async function commit(action: TimelineAction | null): Promise<void> {
    if (action === null) return;
    remember([...undoStack(), action].slice(-HISTORY_LIMIT), []);
    await persist();
  }

  /**
   * Pops until something applies. An action goes stale when the timeline moved past it,
   * for instance the entry was already removed on another device; skipping keeps the
   * button useful instead of dead.
   */
  async function step(
    from: Accessor<readonly TimelineAction[]>,
    to: Accessor<readonly TimelineAction[]>,
    apply: (action: TimelineAction) => boolean,
    save: (undo: readonly TimelineAction[], redo: readonly TimelineAction[]) => void,
  ): Promise<void> {
    const source = [...from()];
    const target = [...to()];
    let applied = false;

    while (source.length > 0) {
      const action = source.pop();
      if (action === undefined) break;
      if (apply(action)) {
        target.push(action);
        applied = true;
        break;
      }
    }

    save(source, target.slice(-HISTORY_LIMIT));
    if (applied) await persist();
  }

  return {
    saveState,
    error,
    canUndo: () => undoStack().length > 0,
    canRedo: () => redoStack().length > 0,
    append: (entries) => commit(appendEntries(handles.timeline, entries)),
    update: (id, text) => commit(updateEntry(handles.timeline, id, text)),
    remove: (id) => commit(deleteEntry(handles.timeline, id)),
    undo: () =>
      step(
        undoStack,
        redoStack,
        (action) => undoAction(handles.timeline, action),
        (undo, redo) => remember(undo, redo),
      ),
    redo: () =>
      step(
        redoStack,
        undoStack,
        (action) => redoAction(handles.timeline, action),
        (redo, undo) => remember(undo, redo),
      ),
  };
}

function emptyHistory(): TimelineHistory {
  return { version: 1, undo: [], redo: [] };
}

function readHistory(key: string): TimelineHistory {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return emptyHistory();
    const parsed = TimelineHistory.safeParse(JSON.parse(raw));
    if (!parsed.success) return emptyHistory();
    return {
      version: 1,
      undo: parsed.data.undo.slice(-HISTORY_LIMIT),
      redo: parsed.data.redo.slice(-HISTORY_LIMIT),
    };
  } catch {
    return emptyHistory();
  }
}

function writeHistory(key: string, history: TimelineHistory): void {
  try {
    localStorage.setItem(key, JSON.stringify(history));
  } catch {
    // Out of quota: keep the most recent steps rather than losing undo entirely. The
    // in-memory stack stays whole for this session; only a reload sees the shorter one.
    try {
      localStorage.setItem(
        key,
        JSON.stringify({ version: 1, undo: history.undo.slice(-5), redo: [] }),
      );
    } catch {
      // Storage blocked: history lives in memory until the tab closes.
    }
  }
}

function describe(caught: unknown): string {
  return caught instanceof Error ? caught.message : String(caught);
}
