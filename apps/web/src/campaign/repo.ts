import { Repo } from "@automerge/automerge-repo";
import { BroadcastChannelNetworkAdapter } from "@automerge/automerge-repo-network-broadcastchannel";
import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb";

/**
 * Local-only repo: documents persist to IndexedDB and sync between tabs of this origin.
 * A cloud network adapter is added in ROADMAP Slice 12; nothing here changes when it is.
 */
export function createBrowserRepo(): Repo {
  return new Repo({
    storage: new IndexedDBStorageAdapter("archefict"),
    network: [new BroadcastChannelNetworkAdapter()],
  });
}
