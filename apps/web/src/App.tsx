import type { CampaignHandles } from "@archefict/crdt";
import { createResource, createSignal, Show } from "solid-js";
import { createTurnRunner, type SaveState } from "./ai/turn.ts";
import { createDocSignal } from "./campaign/doc-signal.ts";
import { createBrowserRepo } from "./campaign/repo.ts";
import { type Library, openLibrary, requestPersistentStorage } from "./campaign/store.ts";
import { Composer } from "./components/Composer.tsx";
import { NarrativeFeed } from "./components/NarrativeFeed.tsx";
import { SettingsDialog } from "./components/SettingsDialog.tsx";
import { GUEST, Sidebar } from "./components/Sidebar.tsx";
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
            persisted={props.persisted}
            onOpenMenu={() => setSidebarOpen(true)}
          />
        )}
      </Show>

      <SettingsDialog
        open={settingsOpen()}
        settings={settingsStore.settings()}
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
  persisted: boolean;
  onOpenMenu: () => void;
}) {
  const index = createDocSignal(props.handles.index);
  const timeline = createDocSignal(props.handles.timeline);
  const turn = createTurnRunner({
    timeline: props.handles.timeline,
    flush: props.handles.flush,
    settings: props.settings.settings,
  });

  return (
    <main class="flex min-w-0 flex-1 flex-col">
      <header class="flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-2">
        <div class="flex min-w-0 items-baseline gap-3">
          <button
            type="button"
            class="rounded-app border border-border px-2 py-1 text-xs text-fg-muted md:hidden"
            aria-label="Open menu"
            onClick={() => props.onOpenMenu()}
          >
            Menu
          </button>
          <h1 class="truncate text-base font-semibold tracking-wide">{index().name}</h1>
          <span
            class="hidden text-xs text-fg-muted sm:inline"
            title="Whether the browser promised not to evict this campaign's storage"
          >
            {props.persisted ? "storage: persistent" : "storage: best-effort"}
          </span>
          <span class="text-xs text-fg-muted" data-save-state={turn.saveState()}>
            {saveLabel(turn.saveState())}
          </span>
        </div>
        <span class="shrink-0 text-xs text-fg-muted">{props.settings.settings().model}</span>
      </header>

      <NarrativeFeed entries={timeline().entries} streamingText={turn.streamingText()} />

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

function saveLabel(state: SaveState): string {
  switch (state) {
    case "idle":
      return "";
    case "saving":
      return "saving…";
    case "saved":
      return "saved";
    case "failed":
      return "not saved";
  }
}
