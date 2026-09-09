import type { CampaignHandles } from "@archefict/crdt";
import BookOpenText from "lucide-solid/icons/book-open-text";
import Settings from "lucide-solid/icons/settings";
import { createResource, createSignal, Show } from "solid-js";
import { createConversationStore } from "./campaign/conversations.ts";
import { createDocSignal } from "./campaign/doc-signal.ts";
import { createBrowserRepo } from "./campaign/repo.ts";
import { type Library, openLibrary, requestPersistentStorage } from "./campaign/store.ts";
import { EditableTitle } from "./components/EditableTitle.tsx";
import { GUEST, Sidebar } from "./components/Sidebar.tsx";
import { SidebarToggle } from "./components/SidebarToggle.tsx";
import { type Tab, TabBar } from "./components/TabBar.tsx";
import { SettingsPage } from "./settings/SettingsPage.tsx";
import { createSettingsStore, type SettingsStore } from "./settings/store.ts";
import { CampaignSettingsTab } from "./workspace/CampaignSettingsTab.tsx";
import { StoryTab } from "./workspace/StoryTab.tsx";

export function App() {
  const [library] = createResource(async () => openLibrary(createBrowserRepo()));
  // Ask once; the answer is not surfaced anywhere yet (no storage setting by decision).
  void requestPersistentStorage();

  return (
    <Show when={library()} fallback={<Boot error={library.error} />}>
      {(lib) => <Shell library={lib()} />}
    </Show>
  );
}

function Boot(props: { error: unknown }) {
  return (
    <main class="flex h-full items-center justify-center text-fg-muted">
      <Show when={props.error} fallback={<p>Opening campaigns…</p>}>
        {(err) => (
          <p class="text-danger" role="alert">
            Could not open the campaigns: {String(err())}
          </p>
        )}
      </Show>
    </main>
  );
}

function Shell(props: { library: Library }) {
  const settingsStore = createSettingsStore();
  const [settingsOpen, setSettingsOpen] = createSignal(false);
  const [sidebarOpen, setSidebarOpen] = createSignal(false);

  return (
    <div class="flex h-full">
      <SidebarToggle open={sidebarOpen()} onToggle={() => setSidebarOpen((open) => !open)} />
      <Sidebar
        campaigns={props.library.campaigns()}
        activeUrl={settingsOpen() ? null : (props.library.active()?.index.url ?? null)}
        settingsActive={settingsOpen()}
        user={GUEST}
        open={sidebarOpen()}
        onClose={() => setSidebarOpen(false)}
        onSelect={(url) => {
          setSettingsOpen(false);
          props.library.select(url);
        }}
        onCreate={(name) => void props.library.create(name)}
        onDelete={(url) => void props.library.remove(url)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {/* keyed: switching campaigns remounts the session, so drafts, save state and any
          in-flight reply belong to exactly one campaign. */}
      <Show when={props.library.active()} keyed>
        {(handles) => (
          <Session
            handles={handles}
            settings={settingsStore}
            hidden={settingsOpen()}
            blocked={sidebarOpen() || settingsOpen()}
            onRename={(name) => void props.library.rename(name)}
          />
        )}
      </Show>

      <Show when={settingsOpen()}>
        <SettingsPage
          settings={settingsStore.settings()}
          onSave={(next) => settingsStore.save(next)}
        />
      </Show>
    </div>
  );
}

type TabId = "story" | "settings";

/**
 * The default tabs. Library joins when there is a library to show. Users compose their own
 * in Slice 5; Settings is the one that cannot be removed (docs/workspace.md).
 */
const TABS: readonly Tab<TabId>[] = [
  { id: "story", label: "Story", icon: BookOpenText },
  { id: "settings", label: "Campaign settings", icon: Settings },
];

/**
 * One campaign: its title, its tabs, and the panels inside the open tab. Every tab stays
 * mounted and only the open one is displayed, so a reply streaming in the story survives a
 * look at the settings, the way the whole column survives a visit to the settings page.
 */
function Session(props: {
  handles: CampaignHandles;
  settings: SettingsStore;
  /** Another page has the column. Kept mounted so a streaming reply survives the detour. */
  hidden: boolean;
  /** The drawer or another page is over the session: no input, no shortcuts. */
  blocked: boolean;
  onRename: (name: string) => void;
}) {
  const index = createDocSignal(props.handles.index);
  const conversations = createConversationStore(props.handles, index);
  const [tab, setTab] = createSignal<TabId>("story");
  const instructions = () => index().instructions ?? props.settings.settings().systemPrompt;

  return (
    // The hidden attribute would lose to the flex utility, so swap the display class.
    <main
      class="min-w-0 flex-1 flex-col"
      classList={{ flex: !props.hidden, hidden: props.hidden }}
      inert={props.blocked}
    >
      <header class="flex items-center gap-2 py-3 pr-4 pl-14">
        <EditableTitle value={index().name} onCommit={props.onRename} />
        <TabBar class="ml-auto" tabs={TABS} active={tab()} onSelect={setTab} />
      </header>

      <div
        id="tabpanel-story"
        role="tabpanel"
        aria-labelledby="tab-story"
        class="min-h-0 flex-1 flex-col"
        classList={{ flex: tab() === "story", hidden: tab() !== "story" }}
      >
        <StoryTab
          handles={props.handles}
          conversations={conversations}
          settings={props.settings.settings}
          instructions={instructions}
          blocked={props.blocked || tab() !== "story"}
        />
      </div>
      <div
        id="tabpanel-settings"
        role="tabpanel"
        aria-labelledby="tab-settings"
        class="min-h-0 flex-1 flex-col"
        classList={{ flex: tab() === "settings", hidden: tab() !== "settings" }}
      >
        <CampaignSettingsTab
          handles={props.handles}
          index={index}
          fallback={() => props.settings.settings().systemPrompt}
        />
      </div>
    </main>
  );
}
