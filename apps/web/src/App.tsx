import type { CampaignHandles } from "@archefict/crdt";
import { createResource, createSignal, Show } from "solid-js";
import { createTurnRunner, type SaveState } from "./ai/turn.ts";
import { createDocSignal } from "./campaign/doc-signal.ts";
import { createBrowserRepo } from "./campaign/repo.ts";
import { loadOrCreateCampaign, requestPersistentStorage } from "./campaign/store.ts";
import { Composer } from "./components/Composer.tsx";
import { NarrativeFeed } from "./components/NarrativeFeed.tsx";
import { SettingsDialog } from "./components/SettingsDialog.tsx";
import { createSettingsStore } from "./settings.ts";

export function App() {
  const [campaign] = createResource(async () => loadOrCreateCampaign(createBrowserRepo()));
  const [persisted] = createResource(requestPersistentStorage);

  return (
    <Show when={campaign()} fallback={<Boot error={campaign.error} />}>
      {(handles) => <Session handles={handles()} persisted={persisted() ?? false} />}
    </Show>
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

function Boot(props: { error: unknown }) {
  return (
    <main class="flex h-full items-center justify-center text-fg-muted">
      <Show when={props.error} fallback={<p>Opening campaign…</p>}>
        {(err) => (
          <p class="text-danger" role="alert">
            Could not open the campaign: {String(err())}
          </p>
        )}
      </Show>
    </main>
  );
}

function Session(props: { handles: CampaignHandles; persisted: boolean }) {
  const settingsStore = createSettingsStore();
  const index = createDocSignal(props.handles.index);
  const timeline = createDocSignal(props.handles.timeline);
  const turn = createTurnRunner({
    timeline: props.handles.timeline,
    flush: props.handles.flush,
    settings: settingsStore.settings,
  });
  const [settingsOpen, setSettingsOpen] = createSignal(false);

  return (
    <main class="flex h-full flex-col">
      <header class="flex items-center justify-between border-b border-border bg-surface px-4 py-2">
        <div class="flex items-baseline gap-3">
          <h1 class="text-base font-semibold tracking-wide">{index().name}</h1>
          <span
            class="text-xs text-fg-muted"
            title="Whether the browser promised not to evict this campaign's storage"
          >
            {props.persisted ? "storage: persistent" : "storage: best-effort"}
          </span>
          <span class="text-xs text-fg-muted" data-save-state={turn.saveState()}>
            {saveLabel(turn.saveState())}
          </span>
        </div>
        <div class="flex items-center gap-3 text-xs text-fg-muted">
          <span>{settingsStore.settings().model}</span>
          <button
            type="button"
            class="rounded-app border border-border px-2 py-1 hover:bg-surface-raised"
            onClick={() => setSettingsOpen(true)}
          >
            Settings
          </button>
        </div>
      </header>

      <NarrativeFeed entries={timeline().entries} streamingText={turn.streamingText()} />

      <Composer
        draftKey={props.handles.timeline.url}
        busy={turn.busy()}
        hasKey={settingsStore.settings().apiKey !== ""}
        error={turn.error()}
        onSubmit={(text) => void turn.submit(text)}
        onStop={turn.stop}
      />

      <SettingsDialog
        open={settingsOpen()}
        settings={settingsStore.settings()}
        onSave={(next) => {
          settingsStore.save(next);
          setSettingsOpen(false);
        }}
        onClose={() => setSettingsOpen(false)}
      />
    </main>
  );
}
