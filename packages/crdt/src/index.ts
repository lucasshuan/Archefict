/**
 * @archefict/crdt
 *
 * Automerge document shapes and the operations that touch them.
 * Automerge is canonical; everything else is a projection (docs/stack.md).
 *
 * Document granularity (never one document per campaign):
 *   campaign-index  -> name, pointers to the other documents
 *   timeline:<id>   -> the narrative feed
 *
 * Undo: Automerge has no application undo, so every mutation returns the TimelineAction
 * that produced it. The caller keeps the stack; `undoAction` and `redoAction` apply the
 * inverse here, as ordinary changes, so undoing stays mergeable and syncs like any edit.
 *
 * This package knows nothing about the browser or Solid. Adapters are injected by the app.
 */
import { NarrativeEntry, type Provenance, type TimelineAction } from "@archefict/schema";
import { updateText } from "@automerge/automerge";
import type { AutomergeUrl, DocHandle, Repo } from "@automerge/automerge-repo";
import { isValidAutomergeUrl } from "@automerge/automerge-repo";

export type TimelineDoc = {
  entries: NarrativeEntry[];
};

export type CampaignIndexDoc = {
  name: string;
  timelineUrl: AutomergeUrl;
  createdAt: number;
};

export type CampaignHandles = {
  index: DocHandle<CampaignIndexDoc>;
  timeline: DocHandle<TimelineDoc>;
  /**
   * Resolves once every pending change to these documents has reached storage.
   * The Repo saves on a debounce, so a change is not durable until this settles.
   * Call it after every user-visible write; a reload inside the debounce window loses data.
   */
  flush: () => Promise<void>;
};

export function createCampaign(repo: Repo, name: string): CampaignHandles {
  const timeline = repo.create<TimelineDoc>({ entries: [] });
  const index = repo.create<CampaignIndexDoc>({
    name,
    timelineUrl: timeline.url,
    createdAt: Date.now(),
  });
  return withFlush(repo, index, timeline);
}

export async function openCampaign(repo: Repo, indexUrl: string): Promise<CampaignHandles> {
  if (!isValidAutomergeUrl(indexUrl)) {
    throw new Error(`Not an Automerge URL: ${indexUrl}`);
  }
  const index = await repo.find<CampaignIndexDoc>(indexUrl);
  const timeline = await repo.find<TimelineDoc>(index.doc().timelineUrl);
  return withFlush(repo, index, timeline);
}

function withFlush(
  repo: Repo,
  index: DocHandle<CampaignIndexDoc>,
  timeline: DocHandle<TimelineDoc>,
): CampaignHandles {
  return {
    index,
    timeline,
    flush: () => repo.flush([index.documentId, timeline.documentId]),
  };
}

export function renameCampaign(index: DocHandle<CampaignIndexDoc>, name: string): void {
  const trimmed = name.trim();
  if (trimmed === "" || trimmed === index.doc().name) return;
  index.change((doc) => {
    doc.name = trimmed;
  });
}

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
