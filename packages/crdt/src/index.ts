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
 * This package knows nothing about the browser or Solid. Adapters are injected by the app.
 */
import type { NarrativeEntry, Provenance } from "@archefict/schema";
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

export function appendEntry(timeline: DocHandle<TimelineDoc>, entry: NarrativeEntry): void {
  timeline.change((doc) => {
    doc.entries.push(entry);
  });
}

/**
 * Rewrites an entry's text as a minimal text diff, so concurrent edits to the same entry
 * merge character by character instead of one side losing everything.
 */
export function updateEntry(timeline: DocHandle<TimelineDoc>, id: string, text: string): void {
  const i = timeline.doc().entries.findIndex((entry) => entry.id === id);
  if (i < 0) return;
  timeline.change((doc) => {
    updateText(doc, ["entries", i, "text"], text);
    const entry = doc.entries[i];
    if (entry) entry.editedAt = Date.now();
  });
}

export function deleteEntry(timeline: DocHandle<TimelineDoc>, id: string): void {
  const i = timeline.doc().entries.findIndex((entry) => entry.id === id);
  if (i < 0) return;
  timeline.change((doc) => {
    doc.entries.splice(i, 1);
  });
}

export function entriesOf(timeline: DocHandle<TimelineDoc>): readonly NarrativeEntry[] {
  return timeline.doc().entries;
}
