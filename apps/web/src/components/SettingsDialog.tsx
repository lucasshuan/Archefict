import type { ModelInfo } from "@archefict/contract";
import { AiSettings } from "@archefict/schema";
import Bot from "lucide-solid/icons/bot";
import HardDrive from "lucide-solid/icons/hard-drive";
import KeyRound from "lucide-solid/icons/key-round";
import ScrollText from "lucide-solid/icons/scroll-text";
import X from "lucide-solid/icons/x";
import { createEffect, createResource, createSignal, For, Show } from "solid-js";
import { FALLBACK_MODELS, loadModels } from "../api/models.ts";

export function SettingsDialog(props: {
  open: boolean;
  settings: AiSettings;
  /** Whether the browser promised not to evict this origin's storage. */
  persisted: boolean;
  onSave: (next: AiSettings) => void;
  onClose: () => void;
}) {
  let dialog: HTMLDialogElement | undefined;
  const [apiKey, setApiKey] = createSignal(props.settings.apiKey);
  const [narratorModel, setNarratorModel] = createSignal(props.settings.narratorModel);
  const [systemPrompt, setSystemPrompt] = createSignal(props.settings.systemPrompt);
  const [problem, setProblem] = createSignal<string | null>(null);
  const [catalogue] = createResource(loadModels);

  createEffect(() => {
    if (!dialog) return;
    if (props.open) {
      setApiKey(props.settings.apiKey);
      setNarratorModel(props.settings.narratorModel);
      setSystemPrompt(props.settings.systemPrompt);
      setProblem(null);
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  });

  const models = () => catalogue()?.models ?? FALLBACK_MODELS;

  function save(): void {
    const parsed = AiSettings.safeParse({
      apiKey: apiKey().trim(),
      narratorModel: narratorModel().trim(),
      systemPrompt: systemPrompt(),
    });
    if (!parsed.success) {
      setProblem(parsed.error.issues.map((issue) => issue.message).join("; "));
      return;
    }
    props.onSave(parsed.data);
  }

  return (
    <dialog
      ref={dialog}
      class="m-auto max-h-[calc(100vh-2rem)] w-[min(40rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl bg-surface p-0 text-fg shadow-2xl"
      onClose={() => props.onClose()}
      aria-label="Settings"
    >
      <form
        method="dialog"
        class="flex flex-col gap-5 p-5"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold">Settings</h2>
          <button
            type="button"
            class="rounded-app p-1 text-fg-muted hover:bg-surface-raised hover:text-fg"
            aria-label="Close"
            onClick={() => props.onClose()}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <label class="flex flex-col gap-1 text-sm">
          <span class="flex items-center gap-2 text-fg-muted">
            <KeyRound size={14} aria-hidden="true" />
            OpenRouter API key
          </span>
          <input
            type="password"
            autocomplete="off"
            value={apiKey()}
            onInput={(event) => setApiKey(event.currentTarget.value)}
            placeholder="sk-or-…"
            class="rounded-xl bg-bg px-3 py-2 outline-none focus:ring-2 focus:ring-accent/50"
          />
          <span class="text-xs text-fg-muted">
            Stored only in this browser. Calls go straight from here to OpenRouter.
          </span>
        </label>

        <div class="flex flex-col gap-1">
          <span class="flex items-center gap-2 text-sm text-fg-muted">
            <Bot size={14} aria-hidden="true" />
            Narrator model
            <Show when={catalogue()?.source === "fallback"}>
              <span class="text-xs" title="The API is unreachable; showing the built-in list.">
                (offline list)
              </span>
            </Show>
          </span>
          <ModelAutocomplete
            label="Narrator model"
            description="Writes the player-facing narrative."
            value={narratorModel()}
            models={models()}
            onInput={setNarratorModel}
          />
          <datalist id="archefict-models">
            <For each={models()}>{(m) => <option value={m.id}>{m.name}</option>}</For>
          </datalist>
        </div>

        <label class="flex flex-col gap-1 text-sm">
          <span class="flex items-center gap-2 text-fg-muted">
            <ScrollText size={14} aria-hidden="true" />
            Narrator instructions
          </span>
          <textarea
            rows={6}
            value={systemPrompt()}
            onInput={(event) => setSystemPrompt(event.currentTarget.value)}
            class="resize-y rounded-xl bg-bg px-3 py-2 outline-none focus:ring-2 focus:ring-accent/50"
          />
        </label>

        <Show when={problem()}>
          {(message) => (
            <p class="text-sm text-danger" role="alert">
              {message()}
            </p>
          )}
        </Show>

        <div class="flex items-center justify-between gap-3 pt-1">
          <span
            class="flex items-center gap-2 text-xs text-fg-muted"
            title="Whether the browser promised not to evict this campaign's storage"
          >
            <HardDrive size={14} aria-hidden="true" />
            {props.persisted
              ? "Storage: persistent"
              : "Storage: best-effort, the browser may evict it"}
          </span>
          <span class="flex gap-2">
            <button
              type="button"
              class="rounded-app bg-surface-raised px-3 py-1 hover:opacity-80"
              onClick={() => props.onClose()}
            >
              Cancel
            </button>
            <button
              type="submit"
              class="rounded-app bg-accent px-3 py-1 font-medium text-accent-fg hover:opacity-90"
            >
              Save
            </button>
          </span>
        </div>
      </form>
    </dialog>
  );
}

function ModelAutocomplete(props: {
  label: string;
  description: string;
  value: string;
  models: readonly ModelInfo[];
  onInput: (value: string) => void;
}) {
  const selected = () => props.models.find((model) => model.id === props.value);

  return (
    <label class="flex flex-col gap-1 text-sm">
      <span class="sr-only">{props.label}</span>
      <input
        list="archefict-models"
        value={props.value}
        onInput={(event) => props.onInput(event.currentTarget.value)}
        spellcheck={false}
        class="rounded-xl bg-bg px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-accent/50"
      />
      <Show
        when={selected()}
        fallback={
          <span class="text-xs text-fg-muted">
            {props.description} Any OpenRouter model id works.
          </span>
        }
      >
        {(model) => (
          <span class="text-xs text-fg-muted">
            {props.description} {model().name}: ${model().pricing.input}/M in, $
            {model().pricing.output}/M out
            <Show when={model().contextLength > 0}>
              , {Math.round(model().contextLength / 1000)}k context
            </Show>
            .
          </span>
        )}
      </Show>
    </label>
  );
}
