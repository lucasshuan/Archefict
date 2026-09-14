import type { FieldMeta, FieldType } from "@archefict/schema";
import Calendar from "lucide-solid/icons/calendar";
import Check from "lucide-solid/icons/check";
import CircleDot from "lucide-solid/icons/circle-dot";
import Hash from "lucide-solid/icons/hash";
import Sigma from "lucide-solid/icons/sigma";
import SquareCheck from "lucide-solid/icons/square-check";
import Tags from "lucide-solid/icons/tags";
import TypeGlyph from "lucide-solid/icons/type";
import X from "lucide-solid/icons/x";
import { createSignal, For, type JSX, Match, onCleanup, onMount, Show, Switch } from "solid-js";
import { CONTROL } from "../components/control.ts";
import { joinOptions, type Reading, splitOptions } from "./fields.ts";

/**
 * One field, three ways (docs/sheets.md): how it reads, how it is edited, what it is. Shared
 * by the index row above the body and by the chip in the prose, so `1,100 crowns` looks the
 * same in both and a select opens the same list from either. Nothing here writes anywhere;
 * the caller says where a change goes.
 *
 * Everything switches on `meta.type`, never on the meta object: the description is re-derived
 * on every document change, and keying on the object would remount the control under the
 * person's fingers — the input blurs, the editor closes, the character is lost.
 */

export type Icon = (props: {
  size?: number;
  "aria-hidden"?: "true";
  class?: string;
}) => JSX.Element;

export const TYPES: readonly {
  type: FieldType;
  label: string;
  description: string;
  icon: Icon;
}[] = [
  { type: "text", label: "Text", description: "anything", icon: TypeGlyph },
  { type: "number", label: "Number", description: "unit · decimals · thousands", icon: Hash },
  { type: "select", label: "Select", description: "one of a list", icon: CircleDot },
  { type: "multiselect", label: "Multi-select", description: "several of a list", icon: Tags },
  { type: "checkbox", label: "Checkbox", description: "yes or no", icon: SquareCheck },
  { type: "date", label: "Date", description: "campaign time, later", icon: Calendar },
  { type: "formula", label: "Formula", description: "from other fields", icon: Sigma },
];

export function typeIcon(type: FieldType): Icon {
  return TYPES.find((entry) => entry.type === type)?.icon ?? TypeGlyph;
}

const TAG_CLASSES = ["bg-tag-1", "bg-tag-2", "bg-tag-3", "bg-tag-4", "bg-tag-5", "bg-tag-6"];

/** An option's colour is its place in the list; one not in the list stays neutral. */
export function tagClass(option: string, options: readonly string[]): string {
  const index = options.indexOf(option);
  return index < 0 ? "bg-surface-raised" : (TAG_CLASSES[index % TAG_CLASSES.length] ?? "");
}

const CONTROL_INLINE = `${CONTROL} h-7 min-w-0 py-0 text-sm`;

function optionsOf(meta: FieldMeta): readonly string[] {
  return meta.type === "select" || meta.type === "multiselect" ? meta.options : [];
}

function unitOf(meta: FieldMeta): string | null {
  return meta.type === "number" ? (meta.unit ?? null) : null;
}

function exprOf(meta: FieldMeta): string {
  return meta.type === "formula" ? meta.expr : "";
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

export function Tag(props: { option: string; options: readonly string[] }) {
  return (
    <span
      class={`rounded-md px-2 text-[12.5px] leading-normal text-fg ${tagClass(props.option, props.options)}`}
    >
      {props.option}
    </span>
  );
}

export function CheckMark(props: { checked: boolean }) {
  return (
    <span
      class="inline-grid size-3.5 place-items-center rounded border"
      classList={{
        "border-accent bg-accent text-accent-fg": props.checked,
        "border-border": !props.checked,
      }}
      aria-hidden="true"
    >
      <Show when={props.checked}>
        <Check size={10} />
      </Show>
    </span>
  );
}

/** How a field reads at rest. `compact` is the chip: no formula source, no empty word. */
export function FieldDisplay(props: {
  reading: Reading;
  options?: readonly string[] | undefined;
  compact?: boolean | undefined;
}) {
  const options = () => props.options ?? [];
  const kind = () => props.reading.kind;
  const text = () => ("text" in props.reading ? (props.reading.text ?? null) : null);
  return (
    <Switch fallback={<Empty compact={props.compact} />}>
      <Match when={kind() === "text" || kind() === "date"}>
        <span class="text-fg">{text()}</span>
      </Match>
      <Match when={kind() === "number"}>
        <span class="inline-flex items-baseline gap-1">
          <span class="text-fg tabular-nums">{text()}</span>
          <Show when={props.reading.kind === "number" ? props.reading.unit : null}>
            {(unit) => <span class="text-fg-subtle">{unit()}</span>}
          </Show>
        </span>
      </Match>
      <Match when={props.reading.kind === "select" ? props.reading : null}>
        {(reading) => (
          <Show when={reading().option} fallback={<Empty compact={props.compact} />}>
            {(option) => <Tag option={option()} options={options()} />}
          </Show>
        )}
      </Match>
      <Match when={props.reading.kind === "multiselect" ? props.reading : null}>
        {(reading) => (
          <Show when={reading().options.length > 0} fallback={<Empty compact={props.compact} />}>
            <span class="inline-flex flex-wrap items-center gap-1">
              <For each={reading().options}>
                {(option) => <Tag option={option} options={options()} />}
              </For>
            </span>
          </Show>
        )}
      </Match>
      <Match when={props.reading.kind === "checkbox" ? props.reading : null}>
        {(reading) => <CheckMark checked={reading().checked} />}
      </Match>
      <Match when={props.reading.kind === "formula" ? props.reading : null}>
        {(reading) => (
          <span class="inline-flex items-baseline gap-2" title={reading().error ?? undefined}>
            <span
              class="text-fg tabular-nums"
              classList={{ "text-fg-subtle": reading().text === null }}
            >
              {reading().text ?? "—"}
            </span>
            <Show when={!props.compact}>
              <span class="font-mono text-xs text-fg-subtle">= {reading().expr}</span>
            </Show>
          </span>
        )}
      </Match>
    </Switch>
  );
}

function Empty(props: { compact?: boolean | undefined }) {
  return <span class="text-fg-subtle italic">{props.compact ? "—" : "empty"}</span>;
}

// ---------------------------------------------------------------------------
// A popover under an anchor. Fixed, so a scrolling container never clips it.
// ---------------------------------------------------------------------------

/** Closes on a pointer outside the element or Escape, the latter caught before the editor. */
function dismissOn(element: () => HTMLElement | undefined, close: () => void): void {
  const onPointerDown = (event: PointerEvent) => {
    const current = element();
    if (current && event.target instanceof Node && !current.contains(event.target)) close();
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      close();
    }
  };
  document.addEventListener("pointerdown", onPointerDown);
  document.addEventListener("keydown", onKeyDown, true);
  onCleanup(() => {
    document.removeEventListener("pointerdown", onPointerDown);
    document.removeEventListener("keydown", onKeyDown, true);
  });
}

export function Popover(props: {
  anchor: HTMLElement;
  onClose: () => void;
  label: string;
  class?: string | undefined;
  children: JSX.Element;
}) {
  let element: HTMLDivElement | undefined;
  const rect = props.anchor.getBoundingClientRect();
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - 300));
  dismissOn(() => element, props.onClose);
  return (
    <div
      ref={element}
      role="dialog"
      aria-label={props.label}
      class={`fixed z-30 rounded-app border border-border bg-surface-raised py-1 shadow-2xl ${props.class ?? "w-64"}`}
      style={{ left: `${left}px`, top: `${rect.bottom + 4}px` }}
      onMouseDown={(event) => event.stopPropagation()}
    >
      {props.children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Editing
// ---------------------------------------------------------------------------

function focusLater(element: HTMLElement): void {
  queueMicrotask(() => element.focus());
}

/**
 * The editor for one field, by type. Text, number and date are a well in place; select and
 * multi-select open a list under the anchor; a formula edits its expression. A checkbox has
 * no editor — its display toggles. Writes go out as they happen; `onDone` is Enter, Escape,
 * Tab or a pointer elsewhere.
 */
export function FieldEditor(props: {
  name: string;
  value: string;
  meta: FieldMeta;
  anchor: HTMLElement;
  onChange: (value: string) => void;
  onMeta: (meta: FieldMeta) => void;
  onDone: () => void;
}) {
  const type = () => props.meta.type;
  const doneKeys = (event: KeyboardEvent) => {
    if (event.key === "Enter" || event.key === "Escape" || event.key === "Tab") {
      event.preventDefault();
      event.stopPropagation();
      props.onDone();
    }
  };
  return (
    <Switch>
      <Match when={type() === "select" || type() === "multiselect"}>
        <OptionPicker
          name={props.name}
          value={props.value}
          options={optionsOf(props.meta)}
          multiple={type() === "multiselect"}
          anchor={props.anchor}
          onChange={props.onChange}
          onOptions={(options) =>
            props.onMeta({ type: type() === "multiselect" ? "multiselect" : "select", options })
          }
          onDone={props.onDone}
        />
      </Match>
      <Match when={type() === "formula"}>
        <span class="inline-flex items-center gap-1.5">
          <span class="text-fg-subtle">=</span>
          <input
            ref={focusLater}
            value={exprOf(props.meta)}
            aria-label={`${props.name} formula`}
            placeholder="level + prof"
            autocomplete="off"
            spellcheck={false}
            class={`${CONTROL_INLINE} w-48 font-mono text-xs`}
            onInput={(event) => props.onMeta({ type: "formula", expr: event.currentTarget.value })}
            onKeyDown={doneKeys}
            onBlur={props.onDone}
          />
        </span>
      </Match>
      <Match when={type() === "checkbox"}>{null}</Match>
      <Match when={true}>
        <span class="inline-flex items-center gap-1.5">
          <input
            ref={focusLater}
            value={props.value}
            aria-label={`${props.name} value`}
            inputmode={type() === "number" ? "decimal" : undefined}
            autocomplete="off"
            spellcheck={false}
            class={`${CONTROL_INLINE} w-40 tabular-nums`}
            onInput={(event) => props.onChange(event.currentTarget.value)}
            onKeyDown={doneKeys}
            onBlur={props.onDone}
          />
          <Show when={unitOf(props.meta)}>
            {(unit) => <span class="text-sm text-fg-subtle">{unit()}</span>}
          </Show>
        </span>
      </Match>
    </Switch>
  );
}

/** The list behind a select: find or create at the top, the current one checked. */
function OptionPicker(props: {
  name: string;
  value: string;
  options: readonly string[];
  multiple: boolean;
  anchor: HTMLElement;
  onChange: (value: string) => void;
  onOptions: (options: string[]) => void;
  onDone: () => void;
}) {
  const [query, setQuery] = createSignal("");
  const selected = () => (props.multiple ? splitOptions(props.value) : [props.value.trim()]);
  const shown = () =>
    props.options.filter((option) => option.toLowerCase().includes(query().trim().toLowerCase()));
  const creatable = () => {
    const q = query().trim();
    return q !== "" && !props.options.includes(q) ? q : null;
  };

  function pick(option: string): void {
    if (props.multiple) {
      const current = selected();
      const next = current.includes(option)
        ? current.filter((item) => item !== option)
        : [...current, option];
      props.onChange(joinOptions(next));
      return;
    }
    props.onChange(option);
    props.onDone();
  }

  function create(): void {
    const option = creatable();
    if (option === null) return;
    props.onOptions([...props.options, option]);
    pick(option);
    setQuery("");
  }

  return (
    <Popover anchor={props.anchor} onClose={props.onDone} label={`${props.name} options`}>
      <div class="px-2 pb-1">
        <input
          ref={focusLater}
          value={query()}
          aria-label={`Find or create an option for ${props.name}`}
          placeholder="Find or create…"
          autocomplete="off"
          spellcheck={false}
          class={`${CONTROL_INLINE} w-full`}
          onInput={(event) => setQuery(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              const first = shown()[0];
              if (creatable() !== null && (first === undefined || query().trim() !== first)) {
                create();
              } else if (first !== undefined) {
                pick(first);
              }
            }
          }}
        />
      </div>
      <div role="listbox" aria-label={props.name} aria-multiselectable={props.multiple}>
        <For each={shown()}>
          {(option) => (
            <button
              type="button"
              role="option"
              aria-selected={selected().includes(option)}
              class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-fg-muted hover:bg-surface hover:text-fg"
              onClick={() => pick(option)}
            >
              <span class="inline-grid w-3.5 place-items-center">
                <Show when={selected().includes(option)}>
                  <Check size={12} aria-hidden="true" />
                </Show>
              </span>
              <Tag option={option} options={props.options} />
            </button>
          )}
        </For>
      </div>
      <Show when={creatable()}>
        {(option) => (
          <button
            type="button"
            class="flex w-full items-center gap-2 border-t border-border px-3 py-1.5 text-left text-sm text-fg-muted italic hover:bg-surface hover:text-fg"
            onClick={create}
          >
            <span class="w-3.5 text-center not-italic">+</span>
            Create “{option()}”
          </button>
        )}
      </Show>
      <Show when={shown().length === 0 && creatable() === null}>
        <p class="px-3 py-1.5 text-xs text-fg-subtle">Type a name to add the first option.</p>
      </Show>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// What it is
// ---------------------------------------------------------------------------

/** The description a type starts with, carrying over what still applies from the old one. */
function defaultsFor(type: FieldType, previous: FieldMeta, value: string): FieldMeta {
  switch (type) {
    case "number":
      return previous.type === "number" ? previous : { type: "number" };
    case "select":
    case "multiselect": {
      const options =
        previous.type === "select" || previous.type === "multiselect"
          ? previous.options
          : splitOptions(value);
      return { type, options: [...options] };
    }
    case "formula":
      return previous.type === "formula" ? previous : { type: "formula", expr: "" };
    default:
      return { type };
  }
}

/**
 * The menu behind a field's icon: pick a type, then that type's few options underneath —
 * unit, decimals, thousands for a number; the list for a select; the expression for a
 * formula. Changing type never touches the value.
 */
export function TypeMenu(props: {
  name: string;
  meta: FieldMeta;
  /** True when the sheet says so itself; false when the type was inferred or claimed. */
  explicit: boolean;
  /** The model that claims this key, when one does: named, and one click away. */
  claim?: { title: string; onOpen: () => void } | undefined;
  value: string;
  anchor: HTMLElement;
  onMeta: (meta: FieldMeta | null) => void;
  onClose: () => void;
}) {
  return (
    <Popover
      anchor={props.anchor}
      onClose={props.onClose}
      label={`Type of ${props.name}`}
      class="w-72"
    >
      <div class="px-3 pt-1 pb-1.5 text-[11px] font-semibold tracking-[0.08em] text-fg-subtle uppercase">
        Type of {props.name}
      </div>
      <For each={TYPES}>
        {(entry) => (
          <button
            type="button"
            class="grid w-full grid-cols-[18px_1fr_auto] items-center gap-2 px-3 py-1.5 text-left text-sm"
            classList={{
              "bg-surface text-fg": props.meta.type === entry.type,
              "text-fg-muted hover:bg-surface hover:text-fg": props.meta.type !== entry.type,
            }}
            aria-pressed={props.meta.type === entry.type}
            onClick={() => props.onMeta(defaultsFor(entry.type, props.meta, props.value))}
          >
            <entry.icon size={14} aria-hidden="true" class="justify-self-center text-fg-subtle" />
            <span>{entry.label}</span>
            <span class="text-xs text-fg-subtle">{entry.description}</span>
          </button>
        )}
      </For>
      <Show when={props.explicit || props.claim === undefined}>
        <TypeOptions meta={props.meta} onMeta={props.onMeta} />
      </Show>
      <Show when={!props.explicit && props.claim}>
        {(claim) => (
          <div class="mt-1 border-t border-border pt-1">
            <p class="px-3 py-1 text-xs text-fg-subtle">Claimed by {claim().title}.</p>
            <button
              type="button"
              class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-fg-muted hover:bg-surface hover:text-fg"
              onClick={claim().onOpen}
            >
              <span class="w-4.5 text-center text-fg-subtle">◆</span>
              Edit in {claim().title}
              <span class="ml-auto text-xs text-fg-subtle">every sheet that takes it</span>
            </button>
            <button
              type="button"
              class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-fg-muted hover:bg-surface hover:text-fg"
              onClick={() => props.onMeta(structuredClone(props.meta))}
            >
              <span class="w-4.5 text-center text-fg-subtle">↳</span>
              Override here
              <span class="ml-auto text-xs text-fg-subtle">this sheet only</span>
            </button>
          </div>
        )}
      </Show>
      <Show when={props.explicit}>
        <button
          type="button"
          class="mt-1 flex w-full items-center gap-2 border-t border-border px-3 py-1.5 text-left text-sm text-fg-muted hover:bg-surface hover:text-fg"
          onClick={() => props.onMeta(null)}
        >
          <span class="w-4.5 text-center text-fg-subtle">↺</span>
          {props.claim ? `Back to ${props.claim.title}'s` : "Back to inferred"}
        </button>
      </Show>
    </Popover>
  );
}

const OPTION_ROW = "grid grid-cols-[18px_1fr_auto] items-center gap-2 text-sm text-fg-muted";

function TypeOptions(props: { meta: FieldMeta; onMeta: (meta: FieldMeta) => void }) {
  const type = () => props.meta.type;
  const number = () => (props.meta.type === "number" ? props.meta : null);
  const options = () => optionsOf(props.meta);
  const setOptions = (next: string[]) =>
    props.onMeta({ type: type() === "multiselect" ? "multiselect" : "select", options: next });
  return (
    <Switch>
      <Match when={type() === "number"}>
        <div class="mt-1 flex flex-col gap-1.5 border-t border-border px-3 pt-2 pb-1">
          <label class={OPTION_ROW}>
            <span />
            Unit
            <input
              value={number()?.unit ?? ""}
              placeholder="crowns"
              autocomplete="off"
              class={`${CONTROL_INLINE} w-28`}
              onInput={(event) =>
                props.onMeta({
                  ...(number() ?? { type: "number" }),
                  unit: event.currentTarget.value.trim() || undefined,
                })
              }
            />
          </label>
          <label class={OPTION_ROW}>
            <span />
            Decimals
            <input
              type="number"
              min="0"
              max="6"
              value={number()?.decimals ?? ""}
              placeholder="any"
              class={`${CONTROL_INLINE} w-28`}
              onInput={(event) => {
                const raw = event.currentTarget.value;
                const decimals = raw === "" ? undefined : Math.max(0, Math.min(6, Number(raw)));
                props.onMeta({ ...(number() ?? { type: "number" }), decimals });
              }}
            />
          </label>
          <label class={OPTION_ROW}>
            <span />
            Thousands separator
            <input
              type="checkbox"
              checked={number()?.thousands ?? false}
              class="mr-2 accent-accent"
              onChange={(event) =>
                props.onMeta({
                  ...(number() ?? { type: "number" }),
                  thousands: event.currentTarget.checked,
                })
              }
            />
          </label>
        </div>
      </Match>
      <Match when={type() === "select" || type() === "multiselect"}>
        <div class="mt-1 flex flex-col border-t border-border pt-1">
          <For each={options()}>
            {(option) => (
              <div class={`group ${OPTION_ROW} px-3 py-1`}>
                <span />
                <Tag option={option} options={options()} />
                <button
                  type="button"
                  aria-label={`Remove option ${option}`}
                  class="rounded-app p-0.5 text-fg-subtle opacity-0 hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
                  onClick={() => setOptions(options().filter((item) => item !== option))}
                >
                  <X size={12} aria-hidden="true" />
                </button>
              </div>
            )}
          </For>
          <form
            class="grid grid-cols-[18px_1fr] items-center gap-2 px-3 py-1"
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const input = form.querySelector<HTMLInputElement>("input");
              const option = input?.value.trim() ?? "";
              if (option === "" || options().includes(option)) return;
              setOptions([...options(), option]);
              form.reset();
            }}
          >
            <span />
            <input
              placeholder="New option"
              aria-label="New option"
              autocomplete="off"
              class={`${CONTROL_INLINE} w-full`}
            />
          </form>
        </div>
      </Match>
      <Match when={type() === "formula"}>
        <label class="mt-1 grid grid-cols-[18px_1fr] items-center gap-2 border-t border-border px-3 pt-2 pb-1 text-sm text-fg-muted">
          <span class="text-center text-fg-subtle">=</span>
          <input
            value={exprOf(props.meta)}
            placeholder="level + prof"
            aria-label="Formula"
            autocomplete="off"
            spellcheck={false}
            class={`${CONTROL_INLINE} w-full font-mono text-xs`}
            onInput={(event) => props.onMeta({ type: "formula", expr: event.currentTarget.value })}
          />
        </label>
      </Match>
    </Switch>
  );
}

/** Used by the index's add row: a name well that commits on Enter. */
export function NameInput(props: { onCommit: (name: string) => void; onCancel: () => void }) {
  let input: HTMLInputElement | undefined;
  onMount(() => input?.focus());
  return (
    <input
      ref={input}
      placeholder="field name"
      aria-label="New field name"
      autocomplete="off"
      spellcheck={false}
      class={`${CONTROL_INLINE} w-40`}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          const name = event.currentTarget.value.trim();
          if (name === "") props.onCancel();
          else props.onCommit(name);
        } else if (event.key === "Escape") {
          event.preventDefault();
          props.onCancel();
        }
      }}
      onBlur={(event) => {
        if (event.currentTarget.value.trim() === "") props.onCancel();
      }}
    />
  );
}
