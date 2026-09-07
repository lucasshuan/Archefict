import type { ModelInfo } from "@archefict/contract";
import { AiSettings } from "@archefict/schema";
import ArrowLeft from "lucide-solid/icons/arrow-left";
import Bot from "lucide-solid/icons/bot";
import HardDrive from "lucide-solid/icons/hard-drive";
import Info from "lucide-solid/icons/info";
import KeyRound from "lucide-solid/icons/key-round";
import ScrollText from "lucide-solid/icons/scroll-text";
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

const TABS = [
  { id: "ai", label: "AI" },
  { id: "data", label: "Data" },
] as const;

type SettingsTab = (typeof TABS)[number]["id"];

/**
 * A full page rather than a modal: settings will keep growing (appearance, account,
 * plugins), and tabs need room. The campaign behind it is made inert by the shell.
 *
 * Edits are committed when you leave, not discarded, so a half-typed key is never lost.
 * Leaving with an invalid value keeps you here with the reason shown.
 */
export function SettingsPage(props: {
  settings: AiSettings;
  /** Whether the browser promised not to evict this origin's storage. */
  persisted: boolean;
  onSave: (next: AiSettings) => void;
  onClose: () => void;
}) {
  let page: HTMLDivElement | undefined;
  const [tab, setTab] = createSignal<SettingsTab>("ai");
  const [apiKey, setApiKey] = createSignal(props.settings.apiKey);
  const [narratorModel, setNarratorModel] = createSignal(props.settings.narratorModel);
  const [systemPrompt, setSystemPrompt] = createSignal(props.settings.systemPrompt);
  const [problem, setProblem] = createSignal<string | null>(null);
  const [catalogue] = createResource(loadModels);

  onMount(() => {
    page?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      leave();
    };
    document.addEventListener("keydown", onKeyDown);
    onCleanup(() => document.removeEventListener("keydown", onKeyDown));
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

  /** Returns false when the draft is invalid, leaving the reason on screen. */
  function save(): boolean {
    if (!dirty()) return true;
    const parsed = AiSettings.safeParse(draft());
    if (!parsed.success) {
      setProblem(parsed.error.issues.map((issue) => issue.message).join("; "));
      setTab("ai");
      return false;
    }
    setProblem(null);
    props.onSave(parsed.data);
    return true;
  }

  function leave(): void {
    if (save()) props.onClose();
  }

  return (
    <section
      ref={page}
      tabIndex={-1}
      aria-label="Settings"
      class="fixed inset-0 z-40 flex flex-col bg-bg outline-none"
    >
      <header class="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          class="rounded-app p-1.5 text-fg-muted hover:bg-surface-raised hover:text-fg"
          aria-label="Back to campaign"
          title="Back (Escape)"
          onClick={leave}
        >
          <ArrowLeft size={18} aria-hidden="true" />
        </button>
        <h1 class="text-base font-semibold tracking-wide">Settings</h1>
      </header>

      <div class="px-4">
        <div class="mx-auto flex max-w-2xl gap-1" role="tablist" aria-label="Settings sections">
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
                  class="rounded-app px-3 py-1.5 text-sm transition-colors"
                  classList={{
                    "bg-surface-raised text-fg": selected(),
                    "text-fg-muted hover:bg-surface hover:text-fg": !selected(),
                  }}
                  onClick={() => setTab(entry.id)}
                >
                  {entry.label}
                </button>
              );
            }}
          </For>
        </div>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto px-4 py-5">
        <div
          class="mx-auto flex max-w-2xl flex-col gap-5"
          role="tabpanel"
          id={`settings-panel-${tab()}`}
          aria-labelledby={`settings-tab-${tab()}`}
        >
          <Switch>
            <Match when={tab() === "ai"}>
              <Field
                id="settings-api-key"
                icon={<KeyRound size={14} aria-hidden="true" />}
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

              <ModelField
                value={narratorModel()}
                models={models()}
                offline={catalogue()?.source === "fallback"}
                onInput={setNarratorModel}
              />

              <Field
                id="settings-system-prompt"
                icon={<ScrollText size={14} aria-hidden="true" />}
                label="Narrator instructions"
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
            </Match>

            <Match when={tab() === "data"}>
              <InfoRow
                icon={<HardDrive size={14} aria-hidden="true" />}
                label="Local storage"
                value={props.persisted ? "Persistent" : "Best-effort"}
                hint={
                  props.persisted
                    ? "The browser agreed to keep this data until you delete it."
                    : "The browser may evict this data when disk space runs low. Export a campaign before clearing site data."
                }
              />
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
        <div class="mx-auto flex max-w-2xl items-center justify-end gap-3">
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
 * Label plus an info badge. The explanation lives in the badge tooltip rather than under
 * the control, so a page of many settings stays scannable. Hovering the label or the badge
 * shows it, and focusing the badge shows it for the keyboard.
 */
function FieldLabel(props: {
  /** Id of the control this labels, or null when the row is read-only. */
  control: string | null;
  icon: JSX.Element;
  label: string;
  hint: string;
}) {
  const tip = createUniqueId();

  return (
    <div class="group/tip relative flex w-fit items-center gap-2">
      <Show
        when={props.control}
        fallback={
          <span class="flex items-center gap-2 text-fg-muted">
            {props.icon}
            {props.label}
          </span>
        }
      >
        {(control) => (
          <label for={control()} class="flex items-center gap-2 text-fg-muted">
            {props.icon}
            {props.label}
          </label>
        )}
      </Show>
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
function Field(props: {
  id: string;
  icon: JSX.Element;
  label: string;
  hint: string;
  children: JSX.Element;
}) {
  return (
    <div class="flex flex-col gap-1 text-sm">
      <FieldLabel control={props.id} icon={props.icon} label={props.label} hint={props.hint} />
      {props.children}
    </div>
  );
}

/** Read-only state, so no label and no control. */
function InfoRow(props: { icon: JSX.Element; label: string; value: string; hint: string }) {
  return (
    <div class="flex flex-col gap-1 text-sm">
      <FieldLabel control={null} icon={props.icon} label={props.label} hint={props.hint} />
      <p class="rounded-xl bg-surface px-3 py-2">{props.value}</p>
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
          icon={<Bot size={14} aria-hidden="true" />}
          label="Narrator model"
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
