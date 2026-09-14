import {
  type CampaignHandles,
  createCampaign,
  deleteCampaign,
  openCampaign,
  renameCampaign,
} from "@archefict/crdt";
import type { AutomergeUrl, Repo } from "@automerge/automerge-repo";
import { type Accessor, createSignal } from "solid-js";
import { writeDraft } from "../drafts.ts";
import { type LibraryRecord, readLibrary, writeLibrary } from "./library.ts";

export type CampaignSummary = {
  url: AutomergeUrl;
  name: string;
  createdAt: number;
  /** The campaign's chosen picture. Absent: its card draws the placeholder. */
  cover?: string | undefined;
};

export type Library = {
  campaigns: Accessor<readonly CampaignSummary[]>;
  /** The open campaign. Null only for the instant between deleting the last one and creating its replacement. */
  active: Accessor<CampaignHandles | null>;
  select: (url: string) => void;
  create: (name: string) => Promise<void>;
  remove: (url: string) => Promise<void>;
  /** Renames the open campaign. Blank names are ignored. */
  rename: (name: string) => Promise<void>;
};

const DEFAULT_NAME = "Untitled campaign";

/**
 * Opens every known campaign (they are small index documents), drops the ones that no
 * longer exist, and guarantees there is always at least one campaign to play in.
 */
export async function openLibrary(repo: Repo): Promise<Library> {
  const record = readLibrary();
  const opened = new Map<string, CampaignHandles>();

  await Promise.all(
    record.campaigns.map(async (entry) => {
      try {
        opened.set(entry.indexUrl, await openCampaign(repo, entry.indexUrl));
      } catch (error) {
        console.warn(`Campaign ${entry.indexUrl} could not be opened; dropping it.`, error);
      }
    }),
  );
  record.campaigns = record.campaigns.filter((entry) => opened.has(entry.indexUrl));

  if (record.campaigns.length === 0) {
    const handles = await createPersisted(repo, DEFAULT_NAME);
    opened.set(handles.index.url, handles);
    record.campaigns.push({ indexUrl: handles.index.url, createdAt: Date.now() });
  }
  if (record.activeIndexUrl === null || !opened.has(record.activeIndexUrl)) {
    record.activeIndexUrl = record.campaigns[0]?.indexUrl ?? null;
  }
  writeLibrary(record);

  // A campaign whose summary has not changed keeps the same object. The sidebar renders the
  // list with `For`, which tells items apart by identity: hand it a fresh object for every
  // campaign on every commit and it rebuilds every card, so selecting one remounts them all
  // and the card's transitions never run — a rebuilt element is born in its final state.
  let previous: readonly CampaignSummary[] = [];
  const summaries = (): readonly CampaignSummary[] => {
    const known = new Map(previous.map((summary) => [summary.url, summary]));
    const next = record.campaigns.map((entry): CampaignSummary => {
      const doc = opened.get(entry.indexUrl)?.index.doc();
      const summary: CampaignSummary = {
        url: entry.indexUrl as AutomergeUrl,
        name: doc?.name ?? DEFAULT_NAME,
        createdAt: entry.createdAt,
        cover: doc?.cover,
      };
      const old = known.get(summary.url);
      return old &&
        old.name === summary.name &&
        old.createdAt === summary.createdAt &&
        old.cover === summary.cover
        ? old
        : summary;
    });
    previous = next;
    return next;
  };

  const [campaigns, setCampaigns] = createSignal<readonly CampaignSummary[]>(summaries());
  const [active, setActive] = createSignal<CampaignHandles | null>(
    record.activeIndexUrl ? (opened.get(record.activeIndexUrl) ?? null) : null,
  );

  function commit(next: Partial<LibraryRecord>): void {
    Object.assign(record, next);
    writeLibrary(record);
    setCampaigns(summaries());
  }

  function select(url: string): void {
    const handles = opened.get(url);
    if (!handles) return;
    commit({ activeIndexUrl: url });
    setActive(handles);
  }

  async function create(name: string): Promise<void> {
    const handles = await createPersisted(repo, name.trim() === "" ? DEFAULT_NAME : name.trim());
    opened.set(handles.index.url, handles);
    commit({
      campaigns: [...record.campaigns, { indexUrl: handles.index.url, createdAt: Date.now() }],
    });
    select(handles.index.url);
  }

  async function remove(url: string): Promise<void> {
    const handles = opened.get(url);
    if (!handles) return;
    const remaining = record.campaigns.filter((entry) => entry.indexUrl !== url);
    opened.delete(url);

    // Move away from the doomed campaign before its documents disappear.
    if (record.activeIndexUrl === url) {
      const next = remaining[0]?.indexUrl ?? null;
      if (next) {
        commit({ campaigns: remaining, activeIndexUrl: next });
        setActive(opened.get(next) ?? null);
      } else {
        setActive(null);
        commit({ campaigns: remaining, activeIndexUrl: null });
      }
    } else {
      commit({ campaigns: remaining });
    }

    for (const conversation of deleteCampaign(repo, handles.index)) {
      writeDraft(conversation.docUrl, "");
    }

    if (record.campaigns.length === 0) await create(DEFAULT_NAME);
  }

  async function rename(name: string): Promise<void> {
    const handles = active();
    if (!handles) return;
    renameCampaign(handles.index, name);
    await handles.flush();
    setCampaigns(summaries());
  }

  return { campaigns, active, select, create, remove, rename };
}

/** New documents must reach storage before anyone remembers their URL (save debounce). */
async function createPersisted(repo: Repo, name: string): Promise<CampaignHandles> {
  const handles = createCampaign(repo, name);
  await handles.flush();
  return handles;
}

/**
 * Ask the browser not to evict this origin's storage. Best effort; the answer is shown
 * in the header so the durability promise is never silently false (docs/stack.md).
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
