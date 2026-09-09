import { SUGGESTED_MODELS } from "@archefict/ai";
import type { ModelInfo } from "@archefict/contract";
import ChevronDown from "lucide-solid/icons/chevron-down";
import { createEffect, createMemo, createSignal, For, onCleanup, Show } from "solid-js";
import { describe, formatContext, isFree, shortName, usd } from "./model-format.ts";
import { vendorMark } from "./model-vendors.ts";

/** Past this the list stops being a list. The tail is reachable by typing, not scrolling. */
const MAX_ROWS = 60;

/** How far the popup may grow, and the air it keeps from the viewport edge. */
const MAX_POPUP_HEIGHT = 320;
const MIN_POPUP_HEIGHT = 140;
const GAP = 6;
const EDGE = 12;

const SUGGESTED_ORDER = new Map(SUGGESTED_MODELS.map((model, index) => [model.id, index]));

type Placement = { left: number; top: number; width: number; maxHeight: number; up: boolean };

/**
 * The model picker: a free-text field with a listbox under it.
 *
 * It replaces a native <datalist>, which could only render an id and a name as two lines of
 * plain text. Choosing a model is a decision about money and context window, so the row
 * shows both, beside a vendor mark that makes a long catalogue skimmable.
 *
 * Free text is the point, not a fallback: any OpenRouter id is valid, including one the
 * catalogue has not heard of yet, so the input never rejects what is typed and the list only
 * ever suggests. Opening the field unfiltered puts the suggested models first; typing ranks
 * by how well the id matches, not alphabetically.
 *
 * A model that cannot use tools is shown but not offered: dimmed, tagged, skipped by the arrow
 * keys and refused by click and Enter. Shown rather than hidden so its absence explains itself;
 * the field still takes its id as text, and the caption says what that costs.
 */
export function ModelCombobox(props: {
  id: string;
  value: string;
  models: readonly ModelInfo[];
  onInput: (value: string) => void;
}) {
  let field: HTMLDivElement | undefined;
  let input: HTMLInputElement | undefined;
  let list: HTMLDivElement | undefined;

  const [open, setOpen] = createSignal(false);
  const [active, setActive] = createSignal(0);
  // Focusing the field should show the whole catalogue even when it already holds a valid id,
  // which is otherwise its own one-row filter. Only a keystroke turns the text into a query.
  const [typed, setTyped] = createSignal(false);
  const [placement, setPlacement] = createSignal<Placement | null>(null);

  const query = () => (typed() ? props.value.trim().toLowerCase() : "");
  const matches = createMemo(() => rankAll(props.models, query()));
  const visible = createMemo(() => matches().slice(0, MAX_ROWS));
  const hidden = () => matches().length - visible().length;
  /** Where the suggested block ends, so the divider only appears when there is one. */
  const others = createMemo(() =>
    query() === "" ? visible().findIndex((model) => !SUGGESTED_ORDER.has(model.id)) : -1,
  );

  const optionId = (index: number) => `${props.id}-option-${index}`;

  createEffect(() => {
    setActive(nextEnabled(visible(), -1, 1));
    // A new result set starts at the top. Resetting the highlight is not enough on its own:
    // it was already row zero whenever the list had been scrolled by hand rather than by key,
    // so nothing would have moved and a fresh ranking would open halfway down itself.
    if (open() && list) list.scrollTop = 0;
  });

  // The field lives in a scrolling panel, so an absolutely positioned popup would be clipped
  // by it. Fixed and measured instead, re-measured for as long as it is open.
  createEffect(() => {
    if (!open()) return;
    place();
    const remeasure = () => place();
    window.addEventListener("scroll", remeasure, true);
    window.addEventListener("resize", remeasure);
    onCleanup(() => {
      window.removeEventListener("scroll", remeasure, true);
      window.removeEventListener("resize", remeasure);
    });
  });

  createEffect(() => {
    if (!open()) return;
    document.getElementById(optionId(active()))?.scrollIntoView({ block: "nearest" });
  });

  function place(): void {
    if (!field) return;
    const box = field.getBoundingClientRect();
    const below = window.innerHeight - box.bottom - GAP - EDGE;
    const above = box.top - GAP - EDGE;
    const up = below < MIN_POPUP_HEIGHT && above > below;
    setPlacement({
      left: box.left,
      top: up ? box.top - GAP : box.bottom + GAP,
      width: box.width,
      maxHeight: Math.max(MIN_POPUP_HEIGHT, Math.min(MAX_POPUP_HEIGHT, up ? above : below)),
      up,
    });
  }

  function browse(): void {
    setTyped(false);
    setOpen(true);
  }

  function choose(id: string): void {
    props.onInput(id);
    setOpen(false);
    input?.focus();
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open()) {
        browse();
        return;
      }
      if (visible().length === 0) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((index) => nextEnabled(visible(), index, step));
      return;
    }
    if (!open()) return;
    if (event.key === "Enter") {
      const model = visible()[active()];
      if (!model?.tools) return;
      event.preventDefault();
      choose(model.id);
      return;
    }
    if (event.key === "Escape") {
      // Only the list goes away. What was typed is a valid value on its own.
      event.preventDefault();
      setOpen(false);
      return;
    }
    if (event.key === "Tab") setOpen(false);
  }

  return (
    <div ref={field} class="relative">
      <input
        ref={input}
        id={props.id}
        role="combobox"
        aria-expanded={open()}
        aria-controls={`${props.id}-listbox`}
        aria-autocomplete="list"
        aria-activedescendant={open() ? optionId(active()) : undefined}
        autocomplete="off"
        spellcheck={false}
        value={props.value}
        onInput={(event) => {
          setTyped(true);
          setOpen(true);
          props.onInput(event.currentTarget.value);
        }}
        onFocus={browse}
        onClick={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        class="w-full rounded-app border border-border bg-bg py-2 pr-10 pl-3 font-mono text-sm"
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label={open() ? "Hide the model list" : "Show the model list"}
        class="absolute inset-y-0 right-0 flex items-center px-3 text-fg-subtle transition-colors hover:text-fg-muted"
        // Keeps the focus, and the caret, in the input when the chevron is clicked.
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          if (open()) setOpen(false);
          else browse();
          input?.focus();
        }}
      >
        <ChevronDown
          size={16}
          class="transition-transform"
          classList={{ "rotate-180": open() }}
          aria-hidden="true"
        />
      </button>

      <Show when={open() ? placement() : null}>
        {(spot) => (
          <div
            ref={list}
            id={`${props.id}-listbox`}
            role="listbox"
            aria-label="Models"
            class="fixed z-30 overflow-y-auto overscroll-contain rounded-app border border-border bg-surface-raised py-1 shadow-2xl"
            classList={{ "-translate-y-full": spot().up }}
            style={{
              left: `${spot().left}px`,
              top: `${spot().top}px`,
              width: `${spot().width}px`,
              "max-height": `${spot().maxHeight}px`,
            }}
            // The input keeps the focus through a click on a row, so blur cannot race the choice.
            onMouseDown={(event) => event.preventDefault()}
          >
            <Show
              when={visible().length > 0}
              fallback={
                <p class="px-3 py-2 text-sm text-fg-subtle">
                  Nothing in the catalogue matches. The id is sent as typed.
                </p>
              }
            >
              <For each={visible()}>
                {(model, index) => (
                  <>
                    <Show when={query() === "" && index() === 0}>
                      <GroupLabel>Suggested</GroupLabel>
                    </Show>
                    <Show when={index() > 0 && index() === others()}>
                      <GroupLabel>All models</GroupLabel>
                    </Show>
                    <Option
                      id={optionId(index())}
                      model={model}
                      query={query()}
                      active={index() === active()}
                      onHover={() => setActive(index())}
                      onChoose={() => choose(model.id)}
                    />
                  </>
                )}
              </For>
              <Show when={hidden() > 0}>
                <p class="px-3 pt-2 pb-1 text-xs text-fg-subtle">
                  {hidden()} more — keep typing to narrow.
                </p>
              </Show>
            </Show>
          </div>
        )}
      </Show>
    </div>
  );
}

function GroupLabel(props: { children: string }) {
  return (
    <p class="px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-wider text-fg-subtle">
      {props.children}
    </p>
  );
}

/**
 * One row: vendor mark, name over id, and the two numbers the choice actually turns on.
 * Everything else the catalogue knows stays out — a row that lists every property is a row
 * nobody reads.
 */
function Option(props: {
  id: string;
  model: ModelInfo;
  query: string;
  active: boolean;
  onHover: () => void;
  onChoose: () => void;
}) {
  const mark = () => vendorMark(props.model.id);
  const free = () => isFree(props.model);
  const context = () => formatContext(props.model.contextLength);

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: this is the listbox half of a combobox; the keyboard drives it from the input, through aria-activedescendant.
    <div
      id={props.id}
      role="option"
      // Never in the tab order: the input holds the focus and points here with
      // aria-activedescendant, which is what makes one Tab stop out of the whole control.
      tabIndex={-1}
      aria-selected={props.active}
      aria-disabled={!props.model.tools}
      aria-label={describe(props.model)}
      class="flex items-center gap-2.5 px-2 py-1.5"
      classList={{
        "cursor-pointer": props.model.tools,
        "cursor-not-allowed opacity-50": !props.model.tools,
        "bg-accent-muted": props.active,
      }}
      // Move, not enter: scrolling a row under a resting cursor should not steal the highlight.
      // A row the narrator could not use is never highlighted or chosen; it is only shown.
      onMouseMove={() => {
        if (props.model.tools) props.onHover();
      }}
      onClick={() => {
        if (props.model.tools) props.onChoose();
      }}
    >
      <Show
        when={mark().logo}
        fallback={
          <span
            aria-hidden="true"
            class="flex size-7 shrink-0 items-center justify-center rounded-lg text-sm font-semibold"
            style={{ "background-color": mark().tint, color: mark().color }}
          >
            {mark().letter}
          </span>
        }
      >
        {(logo) => (
          // innerHTML is safe here and only here: the string is a build-time constant from
          // the icon package, never a value that reached the app at runtime.
          <span
            aria-hidden="true"
            class="flex size-7 shrink-0 items-center justify-center rounded-lg text-[17px]"
            style={{ "background-color": mark().tint, color: mark().color }}
            innerHTML={logo()}
          />
        )}
      </Show>

      <span class="flex min-w-0 flex-1 flex-col">
        <span class="flex min-w-0 items-center gap-1.5">
          <span class="truncate text-sm text-fg">{shortName(props.model)}</span>
          <Show when={!props.model.tools}>
            <span class="shrink-0 rounded-full bg-surface px-1.5 text-[10px] font-medium tracking-wide text-fg-subtle uppercase">
              no tools
            </span>
          </Show>
        </span>
        <span class="truncate font-mono text-xs text-fg-subtle">
          <Highlight text={props.model.id} query={props.query} />
        </span>
      </span>

      <span class="flex shrink-0 flex-col items-end gap-px text-xs tabular-nums">
        <Show when={context()} fallback={<span class="text-fg-subtle">—</span>}>
          {(size) => <span class="text-fg-muted">{size()}</span>}
        </Show>
        <Show
          when={!free()}
          fallback={<span class="rounded-full bg-accent-muted px-1.5 text-accent">Free</span>}
        >
          <span class="text-fg-subtle">
            {usd(props.model.pricing.input)}
            <span class="px-0.5 opacity-60">→</span>
            {usd(props.model.pricing.output)}
          </span>
        </Show>
      </span>
    </div>
  );
}

/** Marks where the query landed in the id, so a long slug shows why it is in the list. */
function Highlight(props: { text: string; query: string }) {
  const at = () => (props.query === "" ? -1 : props.text.toLowerCase().indexOf(props.query));
  return (
    <Show when={at() >= 0} fallback={props.text}>
      {props.text.slice(0, at())}
      <span class="text-fg">{props.text.slice(at(), at() + props.query.length)}</span>
      {props.text.slice(at() + props.query.length)}
    </Show>
  );
}

/** Sorts the catalogue for a query. Best first; anything that does not match is dropped. */
function rankAll(models: readonly ModelInfo[], query: string): ModelInfo[] {
  const scored: Array<{ model: ModelInfo; score: number }> = [];
  for (const model of models) {
    const score = query === "" ? 0 : scoreModel(model, query);
    if (score === null) continue;
    scored.push({ model, score });
  }
  // Within one rank, models the narrator can use come before the ones it cannot.
  scored.sort(
    (a, b) =>
      a.score - b.score ||
      Number(!a.model.tools) - Number(!b.model.tools) ||
      suggestedRank(a.model.id) - suggestedRank(b.model.id) ||
      a.model.id.localeCompare(b.model.id),
  );
  return scored.map((entry) => entry.model);
}

/**
 * The next row the arrow keys may land on, `step` away from `from` and wrapping. Rows without
 * tool support are passed over; when there is nowhere to go the highlight stays where it is.
 */
function nextEnabled(models: readonly ModelInfo[], from: number, step: number): number {
  const count = models.length;
  for (let moved = 1; moved <= count; moved += 1) {
    const index = (((from + step * moved) % count) + count) % count;
    if (models[index]?.tools) return index;
  }
  return from;
}

/** Lower is better; `null` means no match at all. */
function scoreModel(model: ModelInfo, query: string): number | null {
  const id = model.id.toLowerCase();
  const name = model.name.toLowerCase();
  // Every word has to land somewhere, so "haiku anthropic" finds what "anthropic haiku" does.
  const haystack = `${id} ${name}`;
  if (!query.split(/s+/).every((token) => haystack.includes(token))) return null;
  if (id === query) return 1;
  if (id.startsWith(query)) return 2;
  if (name.startsWith(query)) return 3;
  if (id.includes(query)) return 4;
  return 5;
}

function suggestedRank(id: string): number {
  return SUGGESTED_ORDER.get(id) ?? SUGGESTED_ORDER.size;
}
