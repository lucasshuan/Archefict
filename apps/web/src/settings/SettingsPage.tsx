import type { ModelInfo } from "@archefict/contract";
import { AiSettings } from "@archefict/schema";
import Bot from "lucide-solid/icons/bot";
import Feather from "lucide-solid/icons/feather";
import Info from "lucide-solid/icons/info";
import Plug from "lucide-solid/icons/plug";
import {
  createResource,
  createSignal,
  createUniqueId,
  For,
  type JSX,
  Match,
  onCleanup,
  onMount,
  Show,
  Switch,
} from "solid-js";
import { FALLBACK_MODELS, loadModels } from "../api/models.ts";

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
      {/* pl-14 clears the fixed sidebar toggle, exactly like the campaign header. */}
      <header class="flex items-center py-3 pr-4 pl-14">
        <h1 class="text-base font-semibold tracking-wide">Settings</h1>
      </header>

      <div class="px-4">
        <div class="mx-auto flex max-w-page gap-1" role="tablist" aria-label="Settings sections">
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
          class="mx-auto flex max-w-page flex-col gap-8"
          role="tabpanel"
          id={`settings-panel-${tab()}`}
          aria-labelledby={`settings-tab-${tab()}`}
        >
          <Switch>
            <Match when={tab() === "ai"}>
              <Section title="Provider" icon={Plug}>
                <Field
                  id="settings-api-key"
                  label="OpenRouter API key"
                  hint="Stored only in this browser. Calls go straight from here to OpenRouter."
                >
                  <input
                    id="settings-api-key"
                    type="password"
                    autocomplete="off"
                    value={apiKey()}
                    onInput={(event) => setApiKey(event.currentTarget.value)}
                    placeholder="sk-or-…"
                    class="rounded-xl bg-surface px-3 py-2 outline-none focus:ring-2 focus:ring-accent/50"
                  />
                </Field>
              </Section>

              <Section title="Narrator" icon={Feather}>
                <ModelField
                  value={narratorModel()}
                  models={models()}
                  offline={catalogue()?.source === "fallback"}
                  onInput={setNarratorModel}
                />

                <Field
                  id="settings-system-prompt"
                  label="Instructions"
                  hint="Sent as the system prompt on every turn."
                >
                  <textarea
                    id="settings-system-prompt"
                    rows={8}
                    value={systemPrompt()}
                    onInput={(event) => setSystemPrompt(event.currentTarget.value)}
                    class="resize-y rounded-xl bg-surface px-3 py-2 outline-none focus:ring-2 focus:ring-accent/50"
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

      <footer class="px-4 py-3">
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

/**
 * A titled group of fields, headed by an icon, a label and a rule running to the edge.
 * The rule is the one deliberate line in the app: inside a single scrolling column,
 * surface tone alone does not read as a break.
 */
function Section(props: {
  title: string;
  icon: (props: { size?: number; class?: string }) => JSX.Element;
  children: JSX.Element;
}) {
  const heading = createUniqueId();
  return (
    <section class="flex flex-col gap-4" aria-labelledby={heading}>
      <div class="flex items-center gap-3">
        <h2
          id={heading}
          class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-fg-muted"
        >
          <props.icon size={14} class="text-fg-subtle" />
          {props.title}
        </h2>
        <span class="h-px flex-1 bg-border" aria-hidden="true" />
      </div>
      {props.children}
    </section>
  );
}

/**
 * Label plus an info badge. The explanation lives in the badge tooltip rather than under
 * the control, so a page of many settings stays scannable. Hovering the label or the badge
 * shows it, and focusing the badge shows it for the keyboard.
 */
function FieldLabel(props: { control: string; label: string; hint: string }) {
  const tip = createUniqueId();

  return (
    <div class="group/tip relative flex w-fit items-center gap-2">
      <label for={props.control} class="text-fg-muted">
        {props.label}
      </label>
      <button
        type="button"
        aria-label="More information"
        aria-describedby={tip}
        class="rounded-full text-fg-subtle transition-colors hover:text-fg-muted"
      >
        <Info size={13} aria-hidden="true" />
      </button>
      {/* Beside the badge, so it never covers the control it describes and the scrolling
          panel cannot clip it. Never hit-testable, so it cannot block a click. */}
      <span
        id={tip}
        role="tooltip"
        class="pointer-events-none absolute top-1/2 left-full z-10 ml-2 w-64 max-w-[calc(100vw-2rem)] -translate-y-1/2 rounded-lg bg-surface-raised px-2.5 py-1.5 text-xs text-fg opacity-0 shadow-lg transition-opacity group-hover/tip:opacity-100 group-focus-within/tip:opacity-100 motion-reduce:transition-none"
      >
        {props.hint}
      </span>
    </div>
  );
}

/** A labelled control. The caller gives its input the same id. */
function Field(props: { id: string; label: string; hint: string; children: JSX.Element }) {
  return (
    <div class="flex flex-col gap-1 text-sm">
      <FieldLabel control={props.id} label={props.label} hint={props.hint} />
      {props.children}
    </div>
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
      <input
        id={MODEL_INPUT_ID}
        list="archefict-models"
        value={props.value}
        onInput={(event) => props.onInput(event.currentTarget.value)}
        spellcheck={false}
        class="rounded-xl bg-surface px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-accent/50"
      />
      <datalist id="archefict-models">
        <For each={props.models}>{(model) => <option value={model.id}>{model.name}</option>}</For>
      </datalist>
      {/* The one description that stays on the page: it describes the chosen option. */}
      <Show
        when={selected()}
        fallback={
          <span class="text-xs text-fg-subtle">
            Not in the catalogue. It will still be sent as typed.
          </span>
        }
      >
        {(model) => (
          <span class="text-xs text-fg-subtle">
            {model().name}: ${model().pricing.input}/M in, ${model().pricing.output}/M out
            <Show when={model().contextLength > 0}>
              , {Math.round(model().contextLength / 1000)}k context
            </Show>
            .
          </span>
        )}
      </Show>
    </div>
  );
}
