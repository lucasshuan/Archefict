import type { CampaignHandles } from "@archefict/crdt";
import Check from "lucide-solid/icons/check";
import LoaderCircle from "lucide-solid/icons/loader-circle";
import TriangleAlert from "lucide-solid/icons/triangle-alert";
import { createResource, createSignal, Match, onCleanup, onMount, Show, Switch } from "solid-js";
import { createTurnRunner } from "./ai/turn.ts";
import { createDocSignal } from "./campaign/doc-signal.ts";
import { createBrowserRepo } from "./campaign/repo.ts";
import { type Library, openLibrary, requestPersistentStorage } from "./campaign/store.ts";
import { createTimelineController, type SaveState } from "./campaign/timeline.ts";
import { Composer } from "./components/Composer.tsx";
import { EditableTitle } from "./components/EditableTitle.tsx";
import { NarrativeFeed } from "./components/NarrativeFeed.tsx";
import { GUEST, Sidebar } from "./components/Sidebar.tsx";
import { SidebarToggle } from "./components/SidebarToggle.tsx";
import { SettingsPage } from "./settings/SettingsPage.tsx";
import { createSettingsStore, type SettingsStore } from "./settings/store.ts";

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
          persisted={props.persisted}
          onSave={(next) => settingsStore.save(next)}
        />
      </Show>
    </div>
  );
}

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
  const doc = createDocSignal(props.handles.timeline);
  const timeline = createTimelineController(props.handles);
  const turn = createTurnRunner({
    timeline,
    entries: () => doc().entries,
    settings: props.settings.settings,
  });

  onMount(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (props.blocked || !(event.ctrlKey || event.metaKey) || event.altKey || turn.busy()) {
        return;
      }
      // Inputs keep their own native undo; only the timeline responds outside them.
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
      ) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        void timeline.undo();
      } else if ((key === "z" && event.shiftKey) || key === "y") {
        event.preventDefault();
        void timeline.redo();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    onCleanup(() => document.removeEventListener("keydown", onKeyDown));
  });

  return (
    // The hidden attribute would lose to the flex utility, so swap the display class.
    <main
      class="min-w-0 flex-1 flex-col"
      classList={{ flex: !props.hidden, hidden: props.hidden }}
      inert={props.blocked}
    >
      <header class="flex items-center gap-2 py-3 pl-14 pr-4">
        <EditableTitle value={index().name} onCommit={props.onRename} />
        <SaveIndicator state={timeline.saveState()} />
      </header>

      <NarrativeFeed
        entries={doc().entries}
        streamingText={turn.streamingText()}
        onEdit={(id, text) => void timeline.update(id, text)}
        onDelete={(id) => void timeline.remove(id)}
      />

      <Composer
        draftKey={props.handles.timeline.url}
        busy={turn.busy()}
        hasKey={props.settings.settings().apiKey !== ""}
        error={turn.error() ?? timeline.error()}
        canUndo={timeline.canUndo()}
        canRedo={timeline.canRedo()}
        onSubmit={(text) => void turn.submit(text)}
        onStop={turn.stop}
        onUndo={() => void timeline.undo()}
        onRedo={() => void timeline.redo()}
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
