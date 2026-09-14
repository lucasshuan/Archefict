import type { ModelInfo } from "@archefict/contract";
import { AiSettings } from "@archefict/schema";
import Bot from "lucide-solid/icons/bot";
import Eye from "lucide-solid/icons/eye";
import EyeOff from "lucide-solid/icons/eye-off";
import {
  createResource,
  createSignal,
  For,
  Match,
  onCleanup,
  onMount,
  Show,
  Switch,
} from "solid-js";
import { FALLBACK_MODELS, loadModels } from "../api/models.ts";
import { CONTROL } from "../components/control.ts";
import { ModelCombobox } from "../components/ModelCombobox.tsx";
import { summarise } from "../components/model-format.ts";
import { Field, FieldLabel, Section } from "../components/settings-form.tsx";

/** Icons live on tabs. Fields are plain labels; sections are plain headings. */
const TABS = [{ id: "ai", label: "AI", icon: Bot }] as const;

type SettingsTab = (typeof TABS)[number]["id"];

/**
 * A page in the shell, reached from the sidebar. Tabs are the top level; inside a tab,
 * fields are grouped into titled sections.
 *
 * Edits are committed as the page goes away, so a half-typed key is never lost. An invalid
 * value keeps the draft and shows the reason.
 */
export function SettingsPage(props: { settings: AiSettings; onSave: (next: AiSettings) => void }) {
  let page: HTMLDivElement | undefined;
  const [tab, setTab] = createSignal<SettingsTab>("ai");
  const [apiKey, setApiKey] = createSignal(props.settings.apiKey);
  const [narratorModel, setNarratorModel] = createSignal(props.settings.narratorModel);
  const [systemPrompt, setSystemPrompt] = createSignal(props.settings.systemPrompt);
  const [showKey, setShowKey] = createSignal(false);
  const [problem, setProblem] = createSignal<string | null>(null);
  const [catalogue] = createResource(loadModels);

  onMount(() => page?.focus());

  // Leaving is navigation, through the sidebar, so there is no moment to commit on.
  // Save what is valid as the page goes away; the footer stays for an explicit save.
  onCleanup(() => {
    save();
  });

  const models = () => catalogue()?.models ?? FALLBACK_MODELS;
  const draft = () => ({
    apiKey: apiKey().trim(),
    narratorModel: narratorModel().trim(),
    systemPrompt: systemPrompt(),
  });
  const dirty = () => {
    const next = draft();
    return (
      next.apiKey !== props.settings.apiKey ||
      next.narratorModel !== props.settings.narratorModel ||
      next.systemPrompt !== props.settings.systemPrompt
    );
  };

  /** Shows the reason and keeps the draft when it does not parse. */
  function save(): void {
    if (!dirty()) return;
    const parsed = AiSettings.safeParse(draft());
    if (!parsed.success) {
      setProblem(parsed.error.issues.map((issue) => issue.message).join("; "));
      setTab("ai");
      return;
    }
    setProblem(null);
    props.onSave(parsed.data);
  }

  return (
    <section
      ref={page}
      tabIndex={-1}
      aria-label="Settings"
      class="flex min-w-0 flex-1 flex-col outline-none"
    >
      <header class="flex items-center px-4 py-3">
        <h1 class="text-base font-semibold tracking-wide">Settings</h1>
      </header>

      <div class="border-b border-border px-4">
        <div
          class="mx-auto flex max-w-page gap-1 pb-2"
          role="tablist"
          aria-label="Settings sections"
        >
          <For each={TABS}>
            {(entry) => {
              const selected = () => tab() === entry.id;
              return (
                <button
                  type="button"
                  role="tab"
                  id={`settings-tab-${entry.id}`}
                  aria-selected={selected()}
                  aria-controls={`settings-panel-${entry.id}`}
                  class="flex items-center gap-1.5 rounded-app px-3 py-1.5 text-sm transition-colors"
                  classList={{
                    "bg-surface-raised text-fg": selected(),
                    "text-fg-muted hover:bg-surface hover:text-fg": !selected(),
                  }}
                  onClick={() => setTab(entry.id)}
                >
                  <entry.icon size={14} aria-hidden="true" />
                  {entry.label}
                </button>
              );
            }}
          </For>
        </div>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto px-4 py-5">
        <div
          class="mx-auto flex max-w-page flex-col gap-4"
          role="tabpanel"
          id={`settings-panel-${tab()}`}
          aria-labelledby={`settings-tab-${tab()}`}
        >
          <Switch>
            <Match when={tab() === "ai"}>
              <Section title="Provider">
                <Field
                  id="settings-api-key"
                  label="OpenRouter API key"
                  hint="Stored only in this browser. Calls go straight from here to OpenRouter."
                >
                  <div class="relative">
                    <input
                      id="settings-api-key"
                      type={showKey() ? "text" : "password"}
                      autocomplete="off"
                      spellcheck={false}
                      value={apiKey()}
                      onInput={(event) => setApiKey(event.currentTarget.value)}
                      placeholder="sk-or-…"
                      class={`${CONTROL} w-full pr-10 font-mono`}
                    />
                    <button
                      type="button"
                      aria-label={showKey() ? "Hide the key" : "Show the key"}
                      aria-pressed={showKey()}
                      class="absolute inset-y-0 right-0 flex items-center px-3 text-fg-subtle transition-colors hover:text-fg-muted"
                      onClick={() => setShowKey(!showKey())}
                    >
                      <Show when={showKey()} fallback={<Eye size={15} aria-hidden="true" />}>
                        <EyeOff size={15} aria-hidden="true" />
                      </Show>
                    </button>
                  </div>
                </Field>
              </Section>

              <Section title="Narrator">
                <ModelField
                  value={narratorModel()}
                  models={models()}
                  offline={catalogue()?.source === "fallback"}
                  onInput={setNarratorModel}
                />

                <Field
                  id="settings-system-prompt"
                  label="Default instructions"
                  hint="The narrator's system prompt for every campaign that has not written its own. A campaign's own instructions live in its Settings tab."
                >
                  <textarea
                    id="settings-system-prompt"
                    rows={8}
                    value={systemPrompt()}
                    onInput={(event) => setSystemPrompt(event.currentTarget.value)}
                    class={`${CONTROL} resize-y`}
                  />
                </Field>
              </Section>
            </Match>
          </Switch>

          <Show when={problem()}>
            {(message) => (
              <p class="text-sm text-danger" role="alert">
                {message()}
              </p>
            )}
          </Show>
        </div>
      </div>

      <footer class="border-t border-border px-4 py-3">
        <div class="mx-auto flex max-w-page items-center justify-end gap-3">
          <Show when={dirty()}>
            <span class="mr-auto text-xs text-fg-muted">Unsaved changes</span>
          </Show>
          <button
            type="button"
            disabled={!dirty()}
            class="rounded-app bg-accent px-3 py-1 font-medium text-accent-fg hover:opacity-90 disabled:pointer-events-none disabled:opacity-40"
            onClick={() => save()}
          >
            Save
          </button>
        </div>
      </footer>
    </section>
  );
}
const MODEL_INPUT_ID = "settings-narrator-model";

function ModelField(props: {
  value: string;
  models: readonly ModelInfo[];
  offline: boolean;
  onInput: (value: string) => void;
}) {
  const selected = () => props.models.find((model) => model.id === props.value);

  return (
    <div class="flex flex-col gap-1 text-sm">
      <div class="flex items-center gap-2">
        <FieldLabel
          control={MODEL_INPUT_ID}
          label="Model"
          hint="Writes the player-facing narrative. Any OpenRouter model id works, not only the suggestions."
        />
        <Show when={props.offline}>
          <span
            class="text-xs text-fg-subtle"
            title="The API is unreachable; showing the built-in list."
          >
            (offline list)
          </span>
        </Show>
      </div>
      <ModelCombobox
        id={MODEL_INPUT_ID}
        value={props.value}
        models={props.models}
        onInput={props.onInput}
      />
      {/* What the row in the open list said, for the field once it is closed — same three
          facts, same words. Subtle, because it is a readout. Two things earn the accent: an
          id the catalogue does not know, and a model that cannot use tools — the one fact
          about the value that should change the choice. */}
      <Show
        when={selected()}
        fallback={
          <span class="text-xs text-accent">
            Not in the catalogue. It will still be sent as typed.
          </span>
        }
      >
        {(model) => (
          <span
            class="text-xs"
            classList={{ "text-fg-subtle": model().tools, "text-accent": !model().tools }}
          >
            {summarise(model())}
          </span>
        )}
      </Show>
    </div>
  );
}
