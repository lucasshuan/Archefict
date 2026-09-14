import {
  type CampaignHandles,
  type SheetDoc,
  setSheetField,
  setSheetFieldMeta,
} from "@archefict/crdt";
import type { FieldMeta, SheetSummary } from "@archefict/schema";
import type { Doc } from "@automerge/automerge";
import type { DocHandle } from "@automerge/automerge-repo";
import type { Node as PmNode } from "prosemirror-model";
import { NodeSelection, TextSelection } from "prosemirror-state";
import type { EditorView, NodeView, NodeViewConstructor } from "prosemirror-view";
import { type Accessor, createEffect, createRoot, createSignal, Show } from "solid-js";
import { render } from "solid-js/web";
import type { SheetsStore } from "../campaign/sheets.ts";
import { FieldDisplay, FieldEditor } from "./FieldValue.tsx";
import {
  claimOf,
  editingMeta,
  type Fields,
  inheritedMetas,
  isBlank,
  type Metas,
  readField,
  resolveMeta,
} from "./fields.ts";

/**
 * Chips: the inline nodes that stand for a field or a sheet inside the prose, and the small
 * context that lets them read and write (docs/sheets.md).
 *
 * A field chip is a placement, not the value. It reads `fields[key]` off this sheet's document
 * — or another sheet's, opened on demand — and writes back through `setSheetField`, the same
 * path the index uses, so a chip and the index merge rather than clobber. Borrowed fields are
 * read here and written where they belong. A chip reads and edits through the same pieces as
 * the index row (`FieldValue.tsx`), so `1,100 crowns` and a select's list are the same in both.
 *
 * Every chip is a ProseMirror node view rendering a Solid component into an atom span. Editing
 * happens in controls inside the chip; the view tells ProseMirror to leave those events alone.
 */

export type ChipContext = {
  /** This sheet's document, live. */
  own: Accessor<Doc<SheetDoc>>;
  /** Another sheet's document, opened the first time it is asked for. Null until it arrives. */
  foreign: (id: string) => Accessor<Doc<SheetDoc> | null>;
  titleOf: (id: string) => string | null;
  /** Creates the field as empty when it does not exist, so the index shows it at once. */
  ensureField: (key: string) => void;
  setField: (key: string, value: string) => void;
  setMeta: (key: string, meta: FieldMeta | null) => void;
  /** What the models a sheet takes say about its keys: this sheet with null, another by id. */
  inheritedFor: (sheetId: string | null) => Metas;
  /** The first taken model's own value for a key: what a sheet reads while it has none. */
  defaultFor: (sheetId: string | null, key: string) => string | null;
  openSheet: (id: string) => void;
  sheets: SheetsStore;
  nodeViews: Record<string, NodeViewConstructor>;
  dispose: () => void;
};

export function createChipContext(deps: {
  own: Accessor<Doc<SheetDoc>>;
  ownHandle: DocHandle<SheetDoc>;
  /** This sheet's index record, for the models it takes. */
  summary: Accessor<SheetSummary>;
  flush: () => Promise<void>;
  handles: CampaignHandles;
  sheets: SheetsStore;
}): ChipContext {
  const cache = new Map<string, Accessor<Doc<SheetDoc> | null>>();
  const cleanups: (() => void)[] = [];

  // Signals for foreign sheets are created outside any component, on demand, so they need a
  // root of their own to be disposed with the editor.
  const disposeRoot = createRoot((dispose) => dispose);

  function foreign(id: string): Accessor<Doc<SheetDoc> | null> {
    const cached = cache.get(id);
    if (cached) return cached;
    const [doc, setDoc] = createSignal<Doc<SheetDoc> | null>(null);
    cache.set(id, doc);
    void deps.handles
      .openSheet(id)
      .then((opened) => {
        setDoc(() => opened.doc.doc());
        const onChange = (payload: { doc: Doc<SheetDoc> }) => setDoc(() => payload.doc);
        opened.doc.on("change", onChange);
        cleanups.push(() => opened.doc.off("change", onChange));
      })
      .catch(() => {
        // A missing or unreadable sheet reads as unset. The chip says so.
      });
    return doc;
  }

  function titleOf(id: string): string | null {
    const found =
      deps.sheets.sheets().find((s) => s.id === id) ??
      deps.sheets.archived().find((s) => s.id === id);
    return found ? found.title : null;
  }

  function setField(key: string, value: string): void {
    setSheetField(deps.ownHandle, key, value);
    void deps.flush();
  }

  function setMeta(key: string, meta: FieldMeta | null): void {
    setSheetFieldMeta(deps.ownHandle, key, meta);
    void deps.flush();
  }

  function ensureField(key: string): void {
    if (typeof deps.ownHandle.doc().fields[key] === "string") return;
    setField(key, "");
  }

  function takenDocs(sheetId: string | null): { fields: Fields; meta: Metas | undefined }[] {
    const summary =
      sheetId === null
        ? deps.summary()
        : (deps.sheets.sheets().find((s) => s.id === sheetId) ??
          deps.sheets.archived().find((s) => s.id === sheetId));
    return (summary?.models ?? [])
      .map((id) => foreign(id)())
      .filter((doc): doc is Doc<SheetDoc> => doc !== null)
      .map((doc) => ({ fields: doc.fields, meta: doc.meta }));
  }

  function inheritedFor(sheetId: string | null): Metas {
    return inheritedMetas(takenDocs(sheetId));
  }

  function defaultFor(sheetId: string | null, key: string): string | null {
    const models = takenDocs(sheetId);
    const claim = claimOf(key, models);
    const value = claim === null ? undefined : models[claim]?.fields[key];
    return value?.trim() ? value : null;
  }

  const context: ChipContext = {
    own: deps.own,
    foreign,
    titleOf,
    ensureField,
    setField,
    setMeta,
    inheritedFor,
    defaultFor,
    openSheet: (id) => deps.sheets.select(id),
    sheets: deps.sheets,
    nodeViews: {},
    dispose: () => {
      for (const cleanup of cleanups) cleanup();
      disposeRoot();
    },
  };
  context.nodeViews = {
    field: (node, view, getPos) => new FieldChipView(context, node, view, getPos),
    ref: (node, view, getPos) => new RefChipView(context, node, view, getPos),
  };
  return context;
}

// ---------------------------------------------------------------------------
// Node views
// ---------------------------------------------------------------------------

type GetPos = () => number | undefined;

/** After a chip is done being edited, the caret goes back into the prose right after it. */
function focusAfter(view: EditorView, getPos: GetPos): void {
  const pos = getPos();
  if (pos === undefined) return;
  const $after = view.state.doc.resolve(Math.min(pos + 1, view.state.doc.content.size));
  view.dispatch(view.state.tr.setSelection(TextSelection.near($after)));
  view.focus();
}

/** Events that happen inside the chip's own controls are the chip's, not the editor's. */
function insideControl(dom: HTMLElement, event: Event): boolean {
  const target = event.target;
  if (!(target instanceof Element) || target === dom || !dom.contains(target)) return false;
  return target.closest("input, button, [role='dialog']") !== null;
}

class FieldChipView implements NodeView {
  dom: HTMLSpanElement;
  private setNode: (node: PmNode) => void;
  private setSelected: (selected: boolean) => void;
  private disposeRender: () => void;

  constructor(context: ChipContext, node: PmNode, view: EditorView, getPos: GetPos) {
    this.dom = document.createElement("span");
    this.dom.className = "chip chip-field";
    this.dom.contentEditable = "false";
    const [current, setNode] = createSignal(node);
    const [selected, setSelected] = createSignal(false);
    this.setNode = setNode;
    this.setSelected = setSelected;
    this.disposeRender = render(
      () => (
        <FieldChip
          context={context}
          node={current()}
          selected={selected()}
          onDone={() => focusAfter(view, getPos)}
        />
      ),
      this.dom,
    );
  }

  update(node: PmNode): boolean {
    if (node.type.name !== "field") return false;
    this.setNode(node);
    return true;
  }

  selectNode(): void {
    this.dom.classList.add("ProseMirror-selectednode");
    this.setSelected(true);
  }

  deselectNode(): void {
    this.dom.classList.remove("ProseMirror-selectednode");
    this.setSelected(false);
  }

  stopEvent(event: Event): boolean {
    return insideControl(this.dom, event);
  }

  ignoreMutation(): boolean {
    return true;
  }

  destroy(): void {
    this.disposeRender();
  }
}

class RefChipView implements NodeView {
  dom: HTMLSpanElement;
  private setNode: (node: PmNode) => void;
  private disposeRender: () => void;

  constructor(context: ChipContext, node: PmNode, _view: EditorView, _getPos: GetPos) {
    this.dom = document.createElement("span");
    this.dom.className = "chip chip-ref";
    this.dom.contentEditable = "false";
    const [current, setNode] = createSignal(node);
    this.setNode = setNode;
    this.disposeRender = render(() => <RefChip context={context} node={current()} />, this.dom);
  }

  update(node: PmNode): boolean {
    if (node.type.name !== "ref") return false;
    this.setNode(node);
    return true;
  }

  selectNode(): void {
    this.dom.classList.add("ProseMirror-selectednode");
  }

  deselectNode(): void {
    this.dom.classList.remove("ProseMirror-selectednode");
  }

  stopEvent(event: Event): boolean {
    return insideControl(this.dom, event);
  }

  ignoreMutation(): boolean {
    return true;
  }

  destroy(): void {
    this.disposeRender();
  }
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

/**
 * A placed field. Own: press to edit here, in the control its type calls for; a checkbox
 * toggles on the spot. Borrowed: press to go where it is edited. Selecting an own chip whose
 * field is still empty opens it, so `hp:: ` runs straight into typing the value.
 */
function FieldChip(props: {
  context: ChipContext;
  node: PmNode;
  selected: boolean;
  onDone: () => void;
}) {
  let anchor: HTMLButtonElement | undefined;
  const key = () => String(props.node.attrs["key"]);
  const sheet = () => (props.node.attrs["sheet"] as string | null) ?? null;
  const own = () => sheet() === null;
  const doc = () => {
    const id = sheet();
    return id === null ? props.context.own() : props.context.foreign(id)();
  };
  const value = () => doc()?.fields[key()] ?? "";
  const inherited = () => props.context.inheritedFor(sheet());
  const known = () => {
    const current = doc();
    return (
      current !== null &&
      (key() in current.fields || key() in (current.meta ?? {}) || key() in inherited())
    );
  };
  const meta = () => {
    const current = doc();
    return resolveMeta(key(), current?.fields[key()], current?.meta, inherited());
  };
  const editor = () => {
    const current = doc();
    return editingMeta(key(), current?.fields[key()], current?.meta, inherited());
  };
  const reading = () => {
    const current = doc();
    return current ? readField(key(), current.fields, current.meta, inherited()) : null;
  };
  const options = () => {
    const current = meta();
    return current.type === "select" || current.type === "multiselect" ? current.options : [];
  };
  const owner = () => {
    const id = sheet();
    return id === null ? null : (props.context.titleOf(id) ?? "a missing sheet");
  };
  const [editing, setEditing] = createSignal(false);
  const [armed, setArmed] = createSignal(true);

  // Once per selection, and only after both the selection and the (possibly later) empty
  // field have arrived. Deselecting re-arms it.
  createEffect(() => {
    if (!props.selected) {
      setArmed(true);
      return;
    }
    if (armed() && own() && value() === "" && meta().type !== "checkbox") {
      setArmed(false);
      setEditing(true);
    }
  });

  function finish(): void {
    setEditing(false);
    props.onDone();
  }

  function press(): void {
    if (!own()) {
      const id = sheet();
      if (id !== null && props.context.titleOf(id) !== null) props.context.openSheet(id);
      return;
    }
    if (meta().type === "checkbox") {
      props.context.setField(key(), value().trim() === "true" ? "false" : "true");
      return;
    }
    setEditing(true);
  }

  const label = () => (
    <Show when={props.node.attrs["display"] !== "value"}>
      <span class="text-fg-muted">{key()}</span>
    </Show>
  );

  return (
    <Show
      when={editing() && anchor}
      fallback={
        <button
          ref={anchor}
          type="button"
          class="inline-flex items-baseline gap-1 bg-transparent p-0 text-left"
          title={owner() ? `${key()} · from ${owner()} — open it` : `${key()} — edit`}
          onClick={press}
        >
          {label()}
          <Show when={doc() !== null} fallback={<span class="text-fg-subtle">…</span>}>
            <Show
              when={known() && reading()}
              fallback={<span class="text-fg-subtle italic">unset</span>}
            >
              {(current) => (
                <Show
                  when={isBlank(current()) ? props.context.defaultFor(sheet(), key()) : null}
                  fallback={<FieldDisplay reading={current()} options={options()} compact />}
                >
                  {(fallback) => (
                    <span class="text-fg-subtle" title="The model's default; nothing set here">
                      {fallback()}
                    </span>
                  )}
                </Show>
              )}
            </Show>
          </Show>
        </button>
      }
    >
      {(at) => (
        <span class="inline-flex items-baseline gap-1">
          {label()}
          <FieldEditor
            name={key()}
            value={value()}
            meta={editor()}
            anchor={at()}
            onChange={(next) => props.context.setField(key(), next)}
            onMeta={(next) => props.context.setMeta(key(), next)}
            onDone={finish}
          />
        </span>
      )}
    </Show>
  );
}

function RefChip(props: { context: ChipContext; node: PmNode }) {
  const id = () => String(props.node.attrs["sheet"]);
  const title = () => props.context.titleOf(id());
  return (
    <button
      type="button"
      class="inline-flex items-baseline bg-transparent p-0 text-accent"
      title={title() ? `Open ${title()}` : "This sheet no longer exists"}
      onClick={() => {
        if (title()) props.context.openSheet(id());
      }}
    >
      <Show when={title()} fallback={<span class="text-fg-subtle italic">missing sheet</span>}>
        {(name) => <span>{name()}</span>}
      </Show>
    </button>
  );
}

/** Puts the caret on a chip so that, when its field is empty, it opens for typing. */
export function selectChip(view: EditorView, pos: number): void {
  const tr = view.state.tr.setSelection(NodeSelection.create(view.state.doc, pos));
  view.dispatch(tr);
}
