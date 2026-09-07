import { type CampaignHandles, createCampaign, openCampaign } from "@archefict/crdt";
import type { Repo } from "@automerge/automerge-repo";

const INDEX_URL_KEY = "archefict:campaign:index-url";

/** One campaign per browser for now. Campaign switching arrives with Slice 2. */
export async function loadOrCreateCampaign(repo: Repo): Promise<CampaignHandles> {
  const saved = readSavedUrl();
  if (saved) {
    try {
      return await openCampaign(repo, saved);
    } catch (error) {
      console.warn("Saved campaign could not be opened; starting a new one.", error);
    }
  }
  const handles = createCampaign(repo, "Untitled campaign");
  // The new documents must reach storage before their URL is remembered, or a reload
  // inside the Repo's save debounce finds a pointer to nothing and starts over.
  await handles.flush();
  try {
    localStorage.setItem(INDEX_URL_KEY, handles.index.url);
  } catch {
    // Private mode or blocked storage: the campaign lives until the tab closes.
  }
  return handles;
}

function readSavedUrl(): string | null {
  try {
    return localStorage.getItem(INDEX_URL_KEY);
  } catch {
    return null;
  }
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
