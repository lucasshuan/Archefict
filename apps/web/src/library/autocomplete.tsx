import { type EditorState, NodeSelection, Plugin, PluginKey } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import { createSignal, For, Show } from "solid-js";
import { render } from "solid-js/web";
import type { ChipContext } from "./chips.tsx";

/**
 * The `#` and `{{` popups (docs/sheets.md): `#` lists sheets and inserts a reference; `.` on
 * a highlighted sheet lists that sheet's fields instead; `{{` lists this sheet's own fields and
 * can create one. Enter or Tab takes the highlighted item, Escape puts the popup away until
 * the trigger is typed again.
 *
 * The plugin owns the state — where the trigger is, what has been typed since, which item is
 * lit — and re-derives it from the text before the caret on every change, so undo, remote
 * edits and clicking elsewhere all close it without special cases. The popup is a Solid
 * component rendered into a fixed element under the caret.
 */

type Stage = { kind: "sheets" } | { kind: "fields"; sheet: string | null; title: string | null };

type Active = { stage: Stage; from: number; to: number; query: string; index: number };

type State = { active: Active | null; dismissed: number | null };

type Meta = { type: "close" } | { type: "index"; index: number } | { type: "stage"; stage: Stage };

type Item =
  | { kind: "sheet"; id: string; label: string }
  | { kind: "field"; key: string; label: string; value: string }
  | { kind: "create"; key: string; label: string };

const key = new PluginKey<State>("autocomplete");

/** `#` after a space or at the start, then up to forty characters of the same line. */
const SHEET_TRIGGER = /(^|\s)#([^#\n]{0,40})$/;
const FIELD_TRIGGER = /\{\{([^\s{}]{0,40})$/;

function scan(state: EditorState, prev: Active | null): Active | null {
  const { $from, empty } = state.selection;
  if (!empty || !$from.parent.isTextblock) return null;
  const before = $from.parent.textBetween(0, $from.parentOffset, undefined, "￼");

  const sheets = SHEET_TRIGGER.exec(before);
  if (sheets) {
    const raw = sheets[2] ?? "";
    const from = $from.pos - raw.length - 1;
    const same = prev !== null && prev.from === from;
    // Once `.` picked a sheet, the text still reads `#Title.` and what follows is the field.
    if (same && prev.stage.kind === "fields" && prev.stage.title !== null) {
      const prefix = `${prev.stage.title}.`;
      if (raw.startsWith(prefix)) {
        const query = raw.slice(prefix.length);
        return { ...prev, to: $from.pos, query, index: query === prev.query ? prev.index : 0 };
      }
    }
    return {
      stage: { kind: "sheets" },
      from,
      to: $from.pos,
      query: raw,
      index: same && prev.query === raw ? prev.index : 0,
    };
  }

  const fields = FIELD_TRIGGER.exec(before);
  if (fields) {
    const raw = fields[1] ?? "";
    const from = $from.pos - raw.length - 2;
    const same = prev !== null && prev.from === from;
    return {
      stage: { kind: "fields", sheet: null, title: null },
      from,
      to: $from.pos,
      query: raw,
      index: same && prev.query === raw ? prev.index : 0,
    };
  }
  return null;
}

function items(active: Active, context: ChipContext): Item[] {
  if (active.stage.kind === "sheets") {
    const q = active.query.trim().toLowerCase();
    return context.sheets
      .sheets()
      .map((sheet) => ({ sheet, at: sheet.title.toLowerCase().indexOf(q) }))
      .filter(({ at }) => q === "" || at >= 0)
      .sort((a, b) => a.at - b.at || a.sheet.title.localeCompare(b.sheet.title))
      .slice(0, 8)
      .map(({ sheet }) => ({ kind: "sheet", id: sheet.id, label: sheet.title }));
  }
  const doc = active.stage.sheet === null ? context.own() : context.foreign(active.stage.sheet)();
  const fields = doc?.fields ?? {};
  const keys = Object.keys(fields).sort((a, b) => a.localeCompare(b));
  const q = active.query.trim();
  const found: Item[] = keys
    .filter((k) => k.toLowerCase().includes(q.toLowerCase()))
    .slice(0, 8)
    .map((k) => ({ kind: "field", key: k, label: k, value: fields[k] ?? "" }));
  const canCreate = active.stage.sheet === null && /^[A-Za-z_][\w-]*$/.test(q) && !keys.includes(q);
  if (canCreate) found.push({ kind: "create", key: q, label: `Create field “${q}”` });
  return found;
}

function choose(view: EditorView, active: Active, item: Item, context: ChipContext): void {
  const { schema } = view.state;
  const ref = schema.nodes["ref"];
  const field = schema.nodes["field"];
  if (!ref || !field) return;
  let tr = view.state.tr;
  if (item.kind === "sheet") {
    tr = tr.replaceWith(active.from, active.to, ref.create({ sheet: item.id }));
  } else {
    const sheet = active.stage.kind === "fields" ? active.stage.sheet : null;
    const display = item.kind === "create" ? "pair" : "value";
    tr = tr.replaceWith(active.from, active.to, field.create({ sheet, key: item.key, display }));
    if (item.kind === "create") {
      context.ensureField(item.key);
      tr = tr.setSelection(NodeSelection.create(tr.doc, active.from));
    }
  }
  view.dispatch(tr.setMeta(key, { type: "close" } satisfies Meta));
  view.focus();
}

/** `.` on a highlighted sheet: the text becomes `#Title.` and the list becomes its fields. */
function enterFields(view: EditorView, active: Active, item: Item, context: ChipContext): void {
  if (item.kind !== "sheet") return;
  context.foreign(item.id); // start opening it now; the list fills in when it arrives
  const stage: Stage = { kind: "fields", sheet: item.id, title: item.label };
  view.dispatch(
    view.state.tr
      .insertText(`#${item.label}.`, active.from, active.to)
      .setMeta(key, { type: "stage", stage } satisfies Meta),
  );
}

export function autocomplete(
  context: ChipContext,
  enabled: () => boolean = () => true,
): Plugin<State> {
  return new Plugin<State>({
    key,
    state: {
      init: () => ({ active: null, dismissed: null }),
      apply(tr, prev, _old, next) {
        if (!enabled()) return { active: null, dismissed: null };
        const meta = tr.getMeta(key) as Meta | undefined;
        if (meta?.type === "close") {
          return { active: null, dismissed: prev.active?.from ?? null };
        }
        let active = tr.docChanged || tr.selectionSet ? scan(next, prev.active) : prev.active;
        if (active && prev.dismissed === active.from && prev.active === null) {
          return { active: null, dismissed: prev.dismissed };
        }
        if (meta?.type === "index" && active) active = { ...active, index: meta.index };
        if (meta?.type === "stage" && active)
          active = { ...active, stage: meta.stage, query: "", index: 0 };
        return { active, dismissed: active ? null : prev.dismissed };
      },
    },
    props: {
      handleKeyDown(view, event) {
        if (!enabled()) return false;
        const active = key.getState(view.state)?.active ?? null;
        if (!active) return false;
        const list = items(active, context);
        const move = (step: number) => {
          if (list.length === 0) return;
          const index = (active.index + step + list.length) % list.length;
          view.dispatch(view.state.tr.setMeta(key, { type: "index", index } satisfies Meta));
        };
        switch (event.key) {
          case "ArrowDown":
            move(1);
            return true;
          case "ArrowUp":
            move(-1);
            return true;
          case "Enter":
          case "Tab": {
            // A bare `#` is still just a hash — `# ` is on its way to a heading — so it takes
            // at least one typed character before Enter means "reference the first match".
            if (active.stage.kind === "sheets" && active.query.trim() === "") return false;
            const item = list[active.index] ?? list[0];
            if (!item) return false;
            choose(view, active, item, context);
            return true;
          }
          case "Escape":
            view.dispatch(view.state.tr.setMeta(key, { type: "close" } satisfies Meta));
            return true;
          case ".": {
            if (active.stage.kind !== "sheets") return false;
            const item = list[active.index] ?? list[0];
            if (!item) return false;
            enterFields(view, active, item, context);
            return true;
          }
          default:
            return false;
        }
      },
    },
    view: (view) => new Popup(view, context),
  });
}

class Popup {
  private element: HTMLDivElement;
  private dispose: () => void;
  private setActive: (active: Active | null) => void;
  private setPosition: (position: { left: number; top: number }) => void;

  constructor(view: EditorView, context: ChipContext) {
    this.element = document.createElement("div");
    document.body.appendChild(this.element);
    const [active, setActive] = createSignal<Active | null>(null);
    const [position, setPosition] = createSignal({ left: 0, top: 0 });
    this.setActive = setActive;
    this.setPosition = setPosition;
    this.dispose = render(
      () => (
        <PopupList
          active={active()}
          position={position()}
          context={context}
          onChoose={(item) => {
            const current = active();
            if (current) choose(view, current, item, context);
          }}
          onHighlight={(index) =>
            view.dispatch(view.state.tr.setMeta(key, { type: "index", index } satisfies Meta))
          }
        />
      ),
      this.element,
    );
    this.update(view);
  }

  update(view: EditorView): void {
    const active = key.getState(view.state)?.active ?? null;
    this.setActive(active);
    if (active) {
      const coords = view.coordsAtPos(active.from);
      this.setPosition({
        left: Math.max(8, Math.min(coords.left, window.innerWidth - 300)),
        top: coords.bottom + 4,
      });
    }
  }

  destroy(): void {
    this.dispose();
    this.element.remove();
  }
}

function PopupList(props: {
  active: Active | null;
  position: { left: number; top: number };
  context: ChipContext;
  onChoose: (item: Item) => void;
  onHighlight: (index: number) => void;
}) {
  const list = () => (props.active ? items(props.active, props.context) : []);
  const heading = () => {
    const active = props.active;
    if (!active) return "";
    if (active.stage.kind === "sheets") return "Sheets";
    return active.stage.title ? `Fields of ${active.stage.title}` : "Fields";
  };
  const hint = () => {
    const active = props.active;
    if (!active) return "";
    if (active.stage.kind === "sheets")
      return list().length > 0 ? "Enter to reference · . for its fields" : "No sheet matches";
    return list().length > 0
      ? "Enter to place"
      : active.stage.sheet === null
        ? "Type a name to create a field"
        : "No fields on that sheet yet";
  };
  return (
    <Show when={props.active}>
      <div
        role="listbox"
        aria-label={heading()}
        class="fixed z-30 w-72 rounded-app border border-border bg-surface-raised py-1 shadow-2xl"
        style={{ left: `${props.position.left}px`, top: `${props.position.top}px` }}
        onMouseDown={(event) => event.preventDefault()}
      >
        <div class="px-3 pt-1 pb-1.5 text-[11px] font-semibold tracking-[0.08em] text-fg-subtle uppercase">
          {heading()}
        </div>
        <For each={list()}>
          {(item, index) => (
            <button
              type="button"
              role="option"
              aria-selected={index() === props.active?.index}
              class="flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-sm"
              classList={{
                "bg-surface text-fg": index() === props.active?.index,
                "text-fg-muted": index() !== props.active?.index,
              }}
              onMouseEnter={() => props.onHighlight(index())}
              onClick={() => props.onChoose(item)}
            >
              <span class="truncate" classList={{ italic: item.kind === "create" }}>
                {item.label}
              </span>
              <Show when={item.kind === "field" ? item : null}>
                {(field) => <span class="truncate text-xs text-fg-subtle">{field().value}</span>}
              </Show>
            </button>
          )}
        </For>
        <div class="px-3 pt-1.5 pb-1 text-xs text-fg-subtle">{hint()}</div>
      </div>
    </Show>
  );
}
