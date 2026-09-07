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

export function entriesOf(timeline: DocHandle<TimelineDoc>): readonly NarrativeEntry[] {
  return timeline.doc().entries;
}
