import type { CampaignHandles } from "@archefict/crdt";
import Check from "lucide-solid/icons/check";
import LoaderCircle from "lucide-solid/icons/loader-circle";
import TriangleAlert from "lucide-solid/icons/triangle-alert";
import { createResource, createSignal, Match, Show, Switch } from "solid-js";
import { createTurnRunner, type SaveState } from "./ai/turn.ts";
import { createDocSignal } from "./campaign/doc-signal.ts";
import { createBrowserRepo } from "./campaign/repo.ts";
import { type Library, openLibrary, requestPersistentStorage } from "./campaign/store.ts";
import { Composer } from "./components/Composer.tsx";
import { EditableTitle } from "./components/EditableTitle.tsx";
import { NarrativeFeed } from "./components/NarrativeFeed.tsx";
import { SettingsDialog } from "./components/SettingsDialog.tsx";
import { GUEST, Sidebar } from "./components/Sidebar.tsx";
import { SidebarToggle } from "./components/SidebarToggle.tsx";
import { createSettingsStore, type SettingsStore } from "./settings.ts";

export function App() {
  const [library] = createResource(async () => openLibrary(createBrowserRepo()));
  const [persisted] = createResource(requestPersistentStorage);

  return (
    <Show when={library()} fallback={<Boot error={library.error} />}>
      {(lib) => <Shell library={lib()} persisted={persisted() ?? false} />}
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

function Shell(props: { library: Library; persisted: boolean }) {
  const settingsStore = createSettingsStore();
  const [settingsOpen, setSettingsOpen] = createSignal(false);
  const [sidebarOpen, setSidebarOpen] = createSignal(false);

  return (
    <div class="flex h-full">
      <SidebarToggle open={sidebarOpen()} onToggle={() => setSidebarOpen((open) => !open)} />
      <Sidebar
        campaigns={props.library.campaigns()}
        activeUrl={props.library.active()?.index.url ?? null}
        user={GUEST}
        open={sidebarOpen()}
        onClose={() => setSidebarOpen(false)}
        onSelect={props.library.select}
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
            drawerOpen={sidebarOpen()}
            onRename={(name) => void props.library.rename(name)}
          />
        )}
      </Show>

      <SettingsDialog
        open={settingsOpen()}
        settings={settingsStore.settings()}
        persisted={props.persisted}
        onSave={(next) => {
          settingsStore.save(next);
          setSettingsOpen(false);
        }}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}

function Session(props: {
  handles: CampaignHandles;
  settings: SettingsStore;
  drawerOpen: boolean;
  onRename: (name: string) => void;
}) {
  const index = createDocSignal(props.handles.index);
  const timeline = createDocSignal(props.handles.timeline);
  const turn = createTurnRunner({
    timeline: props.handles.timeline,
    flush: props.handles.flush,
    settings: props.settings.settings,
  });

  return (
    <main class="flex min-w-0 flex-1 flex-col" inert={props.drawerOpen}>
      <header class="flex items-center gap-2 py-3 pl-14 pr-4">
        <EditableTitle value={index().name} onCommit={props.onRename} />
        <SaveIndicator state={turn.saveState()} />
      </header>

      <NarrativeFeed
        entries={timeline().entries}
        streamingText={turn.streamingText()}
        onEdit={(id, text) => void turn.edit(id, text)}
        onDelete={(id) => void turn.remove(id)}
      />

      <Composer
        draftKey={props.handles.timeline.url}
        busy={turn.busy()}
        hasKey={props.settings.settings().apiKey !== ""}
        error={turn.error()}
        onSubmit={(text) => void turn.submit(text)}
        onStop={turn.stop}
      />
    </main>
  );
}

function SaveIndicator(props: { state: SaveState }) {
  return (
    <span
      class="flex items-center text-fg-muted"
      role="status"
      data-save-state={props.state}
      title={saveTitle(props.state)}
    >
      <Switch>
        <Match when={props.state === "saving"}>
          <LoaderCircle size={14} class="animate-spin" aria-hidden="true" />
        </Match>
        <Match when={props.state === "saved"}>
          <Check size={14} aria-hidden="true" />
        </Match>
        <Match when={props.state === "failed"}>
          <TriangleAlert size={14} class="text-danger" aria-hidden="true" />
        </Match>
      </Switch>
      <span class="sr-only">{saveTitle(props.state)}</span>
    </span>
  );
}

function saveTitle(state: SaveState): string {
  switch (state) {
    case "idle":
      return "";
    case "saving":
      return "Saving…";
    case "saved":
      return "Saved";
    case "failed":
      return "Not saved";
  }
}
