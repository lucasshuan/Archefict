import type { CampaignHandles } from "@archefict/crdt";
import BookOpenText from "lucide-solid/icons/book-open-text";
import LibraryIcon from "lucide-solid/icons/library";
import { createResource, createSignal, Show } from "solid-js";
import { createConversationStore } from "./campaign/conversations.ts";
import { createDocSignal } from "./campaign/doc-signal.ts";
import { createBrowserRepo } from "./campaign/repo.ts";
import { createSheetsStore } from "./campaign/sheets.ts";
import { type Library, openLibrary, requestPersistentStorage } from "./campaign/store.ts";
import { GUEST, Sidebar } from "./components/Sidebar.tsx";
import { CampaignSidebar, type Tab } from "./components/TabBar.tsx";
import { LibraryTab } from "./library/LibraryTab.tsx";
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
  const [sidebarOpen, setSidebarOpen] = createSignal(readSidebarPreference());

  function toggleSidebar(): void {
    setSidebarOpen((open) => {
      const next = !open;
      writeSidebarPreference(next);
      return next;
    });
  }

  return (
    <div class="flex h-full">
      <Sidebar
        campaigns={props.library.campaigns()}
        activeUrl={settingsOpen() ? null : (props.library.active()?.index.url ?? null)}
        settingsActive={settingsOpen()}
        user={GUEST}
        open={sidebarOpen()}
        onSelect={(url) => {
          setSettingsOpen(false);
          props.library.select(url);
        }}
        onCreate={(name) => void props.library.create(name)}
        onOpenSettings={() => setSettingsOpen(true)}
        onToggle={toggleSidebar}
      />

      {/* keyed: switching campaigns remounts the session, so drafts, save state and any
          in-flight reply belong to exactly one campaign. */}
      <Show when={props.library.active()} keyed>
        {(handles) => (
          <Session
            handles={handles}
            settings={settingsStore}
            hidden={settingsOpen()}
            blocked={settingsOpen()}
            onRename={(name) => void props.library.rename(name)}
            onDelete={() => void props.library.remove(handles.index.url)}
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

type TabId = "story" | "library" | "settings";

/**
 * The ground a tab's panels sit on, padded so every panel has a gutter of it on all sides.
 * The campaign has no title bar — its name is in the right sidebar — so the panels start at
 * the top of the page and the ground is padded evenly.
 */
const TAB_GROUND = "min-h-0 flex-1 flex-col p-2";

/**
 * The default tabs: the campaign's working views. Users compose their own in Slice 5
 * (docs/workspace.md). Campaign settings is not among them — it hangs off the cover in the
 * right sidebar, because it configures the campaign rather than being a view of it.
 */
const TABS: readonly Tab<TabId>[] = [
  { id: "story", label: "Story", icon: BookOpenText },
  { id: "library", label: "Library", icon: LibraryIcon },
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
  /** Another page has the shell: no input, no shortcuts. */
  blocked: boolean;
  onRename: (name: string) => void;
  /** Deletes this campaign and everything in it. Confirmed in Campaign Settings first. */
  onDelete: () => void;
}) {
  const index = createDocSignal(props.handles.index);
  const conversations = createConversationStore(props.handles, index);
  const sheets = createSheetsStore(props.handles, index);
  const [tab, setTab] = createSignal<TabId>("story");
  const [campaignSidebarExpanded, setCampaignSidebarExpanded] = createSignal(
    readCampaignSidebarPreference(),
  );
  const instructions = () => index().instructions ?? props.settings.settings().systemPrompt;

  function toggleCampaignSidebar(): void {
    setCampaignSidebarExpanded((expanded) => {
      const next = !expanded;
      writeCampaignSidebarPreference(next);
      return next;
    });
  }

  return (
    // The hidden attribute would lose to the flex utility, so swap the display class.
    <main
      class="min-w-0 flex-1 bg-bg"
      classList={{ flex: !props.hidden, hidden: props.hidden }}
      inert={props.blocked}
    >
      <section class="flex min-w-0 flex-1 flex-col" aria-label={index().name}>
        <div
          id="tabpanel-story"
          role="tabpanel"
          aria-labelledby="tab-story"
          class={TAB_GROUND}
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
          id="tabpanel-library"
          role="tabpanel"
          aria-labelledby="tab-library"
          class={TAB_GROUND}
          classList={{ flex: tab() === "library", hidden: tab() !== "library" }}
        >
          <LibraryTab handles={props.handles} sheets={sheets} />
        </div>
        <div
          id="tabpanel-settings"
          role="tabpanel"
          aria-labelledby="tab-settings"
          // Not TAB_GROUND: that gutter is the gap between panels, and this tab has none.
          // It is a settings page and sits flush, the way the global Settings page does.
          class="min-h-0 flex-1 flex-col"
          classList={{ flex: tab() === "settings", hidden: tab() !== "settings" }}
        >
          <CampaignSettingsTab
            handles={props.handles}
            index={index}
            fallback={() => props.settings.settings().systemPrompt}
            onRename={props.onRename}
            onDelete={props.onDelete}
          />
        </div>
      </section>
      <CampaignSidebar
        tabs={TABS}
        active={tab()}
        expanded={campaignSidebarExpanded()}
        title={index().name}
        cover={index().cover}
        // The same seed the campaign's card uses in the left sidebar, so one campaign is one
        // colour in both places.
        seed={props.handles.index.url}
        settingsTab="settings"
        onSelect={setTab}
        onToggle={toggleCampaignSidebar}
      />
    </main>
  );
}

const SIDEBAR_KEY = "archefict:campaign-sidebar";
const CAMPAIGN_SIDEBAR_KEY = "archefict:campaign-navigation";

function readSidebarPreference(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_KEY) !== "hidden";
  } catch {
    return true;
  }
}

function writeSidebarPreference(open: boolean): void {
  try {
    localStorage.setItem(SIDEBAR_KEY, open ? "shown" : "hidden");
  } catch {
    // Storage blocked: the choice lasts until the page closes.
  }
}

function readCampaignSidebarPreference(): boolean {
  try {
    return localStorage.getItem(CAMPAIGN_SIDEBAR_KEY) !== "collapsed";
  } catch {
    return true;
  }
}

function writeCampaignSidebarPreference(expanded: boolean): void {
  try {
    localStorage.setItem(CAMPAIGN_SIDEBAR_KEY, expanded ? "expanded" : "collapsed");
  } catch {
    // Storage blocked: the choice lasts until the campaign closes.
  }
}
