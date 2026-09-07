import { AiSettings } from "@archefict/schema";
import { createEffect, createResource, createSignal, For, Show } from "solid-js";
import { FALLBACK_MODELS, loadModels } from "../api/models.ts";

export function SettingsDialog(props: {
  open: boolean;
  settings: AiSettings;
  onSave: (next: AiSettings) => void;
  onClose: () => void;
}) {
  let dialog: HTMLDialogElement | undefined;
  const [apiKey, setApiKey] = createSignal(props.settings.apiKey);
  const [model, setModel] = createSignal(props.settings.model);
  const [systemPrompt, setSystemPrompt] = createSignal(props.settings.systemPrompt);
  const [problem, setProblem] = createSignal<string | null>(null);
  const [catalogue] = createResource(loadModels);

  createEffect(() => {
    if (!dialog) return;
    if (props.open) {
      setApiKey(props.settings.apiKey);
      setModel(props.settings.model);
      setSystemPrompt(props.settings.systemPrompt);
      setProblem(null);
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  });

  const models = () => catalogue()?.models ?? FALLBACK_MODELS;
  const selected = () => models().find((m) => m.id === model());

  function save(): void {
    const parsed = AiSettings.safeParse({
      apiKey: apiKey().trim(),
      model: model().trim(),
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
      class="m-auto w-[min(40rem,calc(100vw-2rem))] rounded-app border border-border bg-surface p-0 text-fg"
      onClose={() => props.onClose()}
      aria-label="Settings"
    >
      <form
        method="dialog"
        class="flex flex-col gap-4 p-5"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <h2 class="text-lg font-semibold">Settings</h2>

        <label class="flex flex-col gap-1 text-sm">
          <span class="text-fg-muted">OpenRouter API key</span>
          <input
            type="password"
            autocomplete="off"
            value={apiKey()}
            onInput={(event) => setApiKey(event.currentTarget.value)}
            placeholder="sk-or-…"
            class="rounded-app border border-border bg-bg px-3 py-2 outline-none focus:border-accent"
          />
          <span class="text-xs text-fg-muted">
            Stored only in this browser. Calls go straight from here to OpenRouter.
          </span>
        </label>

        <label class="flex flex-col gap-1 text-sm">
          <span class="text-fg-muted">
            Model
            <Show when={catalogue()?.source === "fallback"}>
              <span title="The API is unreachable; showing the built-in list.">
                {" "}
                (offline list)
              </span>
            </Show>
          </span>
          <input
            list="archefict-models"
            value={model()}
            onInput={(event) => setModel(event.currentTarget.value)}
            spellcheck={false}
            class="rounded-app border border-border bg-bg px-3 py-2 font-mono text-sm outline-none focus:border-accent"
          />
          <datalist id="archefict-models">
            <For each={models()}>{(m) => <option value={m.id}>{m.name}</option>}</For>
          </datalist>
          <Show
            when={selected()}
            fallback={<span class="text-xs text-fg-muted">Any OpenRouter model id works.</span>}
          >
            {(m) => (
              <span class="text-xs text-fg-muted">
                {m().name}: ${m().pricing.input}/M in, ${m().pricing.output}/M out
                <Show when={m().contextLength > 0}>
                  , {Math.round(m().contextLength / 1000)}k context
                </Show>
                .
              </span>
            )}
          </Show>
        </label>

        <label class="flex flex-col gap-1 text-sm">
          <span class="text-fg-muted">Narrator instructions</span>
          <textarea
            rows={6}
            value={systemPrompt()}
            onInput={(event) => setSystemPrompt(event.currentTarget.value)}
            class="resize-y rounded-app border border-border bg-bg px-3 py-2 outline-none focus:border-accent"
          />
        </label>

        <Show when={problem()}>
          {(message) => (
            <p class="text-sm text-danger" role="alert">
              {message()}
            </p>
          )}
        </Show>

        <div class="flex justify-end gap-2">
          <button
            type="button"
            class="rounded-app border border-border px-3 py-1 hover:bg-surface-raised"
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
        </div>
      </form>
    </dialog>
  );
}
