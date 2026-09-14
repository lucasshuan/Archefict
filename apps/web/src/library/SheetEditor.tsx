import {
  type CampaignHandles,
  type SheetHandles,
  setSheetField,
  setSheetFieldMeta,
} from "@archefict/crdt";
import type { SheetSummary } from "@archefict/schema";
import { init } from "@automerge/prosemirror";
import FileCode from "lucide-solid/icons/file-code";
import ListTree from "lucide-solid/icons/list-tree";
import { baseKeymap, setBlockType, toggleMark } from "prosemirror-commands";
import { closeHistory, history, redo, undo } from "prosemirror-history";
import {
  type InputRule,
  inputRules,
  textblockTypeInputRule,
  undoInputRule,
  wrappingInputRule,
} from "prosemirror-inputrules";
import { keymap } from "prosemirror-keymap";
import type { Schema } from "prosemirror-model";
import { liftListItem, sinkListItem, splitListItem } from "prosemirror-schema-list";
import {
  type Command,
  EditorState,
  type Plugin,
  TextSelection,
  type Transaction,
} from "prosemirror-state";
import {
  addRowAfter,
  goToNextCell,
  isInTable,
  selectedRect,
  tableEditing,
} from "prosemirror-tables";
import { EditorView } from "prosemirror-view";
import "prosemirror-view/style/prosemirror.css";
import "prosemirror-tables/style/tables.css";
import {
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { createDocSignal } from "../campaign/doc-signal.ts";
import type { SheetsStore } from "../campaign/sheets.ts";
import type { MenuItem } from "../components/Menu.tsx";
import { Panel } from "../components/Panel.tsx";
import { autocomplete } from "./autocomplete.tsx";
import { createChipContext } from "./chips.tsx";
import { fieldRules } from "./field-rules.ts";
import { fieldKeys } from "./fields.ts";
import { ModelPills } from "./ModelPills.tsx";
import { PropertiesBlock, type TakenModel } from "./PropertiesBlock.tsx";
import { SheetToolbar } from "./SheetToolbar.tsx";
import { createSheetAdapter } from "./schema.ts";
import { parseRaw, serializeRaw } from "./serialize.ts";
import type { SheetViewStore } from "./view-store.ts";

/**
 * A sheet's body: ProseMirror over the Automerge document, through @automerge/prosemirror and
 * the sheet schema (`schema.ts`). Automerge stays canonical; the editor is a view of it that
 * writes back as it goes, so a second tab follows every keystroke (Phase 0 spike).
 *
 * The toolbar sits between the panel bar and the body and reads the editor state as a
 * signal, which every transaction — typed, remote, undone — updates, so its buttons never
 * disagree with the selection. Markdown shortcuts (`## `, `- `, `1. `, `> `, ```` ``` ````)
 * become blocks as they are typed; Backspace straight after one takes it back.
 *
 * Fields and references are chips (`chips.tsx`): `hp:: ` and `{{hp}}` become field chips as
 * they are typed (`field-rules.ts`), `#` and `{{` open the popups (`autocomplete.tsx`).
 *
 * Two views on top of the rendered one (`view-store.ts`, docs/sheets.md): the field index
 * above the body, and the editable raw source in place of it. Raw parses back into the same
 * editor state, which stays mounted underneath so switching views is instant.
 *
 * In a table, Tab and Shift-Tab walk the cells and Enter goes down a column, growing the
 * table at the bottom. A cell is a single line (`schema.ts` says why), so Enter never splits
 * one.
 *
 * Pasted images are dropped for now. The image block exists in the schema, but a pasted
 * `<img>` would load an arbitrary URL; images come from local assets later in Slice 1.
 */
export function SheetEditor(props: {
  sheet: SheetHandles;
  handles: CampaignHandles;
  sheets: SheetsStore;
  view: SheetViewStore;
  /** This sheet's index record: its title, its kind, the models it takes. */
  summary: SheetSummary;
  onRename: (title: string) => void;
}) {
  let mount: HTMLDivElement | undefined;
  let rawInput: HTMLTextAreaElement | undefined;
  let rawVisible = false;
  const [view, setView] = createSignal<EditorView | null>(null);
  const [state, setState] = createSignal<EditorState | null>(null);
  const [rawDraft, setRawDraft] = createSignal("");
  const own = createDocSignal(props.sheet.doc);
  const chips = createChipContext({
    own,
    ownHandle: props.sheet.doc,
    summary: () => props.summary,
    flush: props.sheet.flush,
    handles: props.handles,
    sheets: props.sheets,
  });

  onMount(() => {
    if (!mount) return;
    const { schema, pmDoc, plugin } = init(props.sheet.doc, ["body"], {
      schemaAdapter: createSheetAdapter(),
    });
    const initial = EditorState.create({
      schema,
      doc: pmDoc,
      plugins: [
        // First, so an open popup takes Enter, Tab and the arrows before any keymap does.
        autocomplete(chips, () => !props.view.view().raw),
        keymap({ Backspace: undoInputRule }),
        markdownShortcuts(schema),
        fieldRules(schema, chips),
        keymap(tableKeys()),
        keymap(listKeys(schema)),
        keymap({
          ...markKeys(schema),
          ...blockKeys(schema),
          "Mod-z": undo,
          "Mod-y": redo,
          "Mod-Shift-z": redo,
        }),
        keymap(baseKeymap),
        history(),
        tableEditing(),
        plugin,
      ],
    });
    const editor: EditorView = new EditorView(mount, {
      state: initial,
      nodeViews: chips.nodeViews,
      dispatchTransaction: (transaction) => {
        const next = editor.state.apply(transaction);
        editor.updateState(next);
        setState(next);
      },
      transformPastedHTML: (html) => html.replace(/<img\b[^>]*>/gi, ""),
    });
    setView(editor);
    setState(initial);
  });
  onCleanup(() => {
    view()?.destroy();
    chips.dispose();
  });

  // A toolbar press is one undo step of its own. Typing groups into history by time; two
  // presses inside that window would otherwise fold into one event and undo together.
  function run(command: Command): void {
    const current = view();
    if (!current) return;
    command(current.state, (tr) => current.dispatch(closeHistory(tr)), current);
    if (props.view.view().raw) {
      setRawDraft(currentRaw());
      queueMicrotask(() => {
        resizeRaw(rawInput);
        rawInput?.focus();
      });
    } else {
      current.focus();
    }
  }

  function currentRaw(): string {
    const current = state();
    if (!current) return "";
    return serializeRaw(current.doc, { fields: own().fields, titleOf: chips.titleOf });
  }

  // Take a fresh snapshot only when raw first opens. Transactions caused by raw typing must
  // not serialise back over the textarea: preserving the person's whitespace and half-typed
  // syntax is what makes this a source editor rather than a formatting command.
  createEffect(() => {
    const showing = props.view.view().raw;
    const current = state();
    if (!showing) {
      rawVisible = false;
      return;
    }
    if (!current || rawVisible) return;
    rawVisible = true;
    setRawDraft(currentRaw());
    queueMicrotask(() => resizeRaw(rawInput));
  });

  function updateRaw(source: string): void {
    setRawDraft(source);
    const editor = view();
    if (!editor) return;
    const parsed = parseRaw(source, editor.state.schema);
    if (!editor.state.doc.eq(parsed.doc)) {
      editor.dispatch(
        editor.state.tr.replaceWith(0, editor.state.doc.content.size, parsed.doc.content),
      );
    }
    for (const [key, value] of parsed.fields) setSheetField(props.sheet.doc, key, value);
    if (parsed.fields.size > 0) void props.sheet.flush();
  }

  function toggleRaw(): void {
    const entering = !props.view.view().raw;
    props.view.toggleRaw();
    if (entering) {
      // Re-run plugin state after the view changes so an autocomplete opened in rendered
      // mode disappears immediately, before raw typing starts.
      const editor = view();
      if (editor) editor.dispatch(editor.state.tr);
      queueMicrotask(() => rawInput?.focus());
    }
  }

  // The models this sheet takes, with their documents as they arrive (docs/sheets.md).
  const taken = createMemo((): TakenModel[] =>
    (props.summary.models ?? []).map((id) => {
      const doc = chips.foreign(id)();
      return {
        id,
        title: chips.titleOf(id) ?? "a missing model",
        fields: doc?.fields ?? {},
        meta: doc?.meta,
      };
    }),
  );

  /**
   * The shape this sheet already has, as a model others can take: keys and their types are
   * copied, values are not — a model's values are defaults, and this sheet's are its own.
   * Taken here at once, so what was just promoted still claims what it came from.
   */
  async function saveAsModel(): Promise<void> {
    const current = own();
    const created = await props.handles.createSheet(`${props.summary.title} model`, null, {
      kind: "model",
    });
    const model = await props.handles.openSheet(created.id);
    for (const key of fieldKeys(current.fields, current.meta)) {
      const meta = current.meta?.[key];
      if (meta) setSheetFieldMeta(model.doc, key, meta);
      if (meta?.type !== "formula") setSheetField(model.doc, key, "");
    }
    await model.flush();
    await props.sheets.setSheetModels(props.summary.id, [
      ...(props.summary.models ?? []),
      created.id,
    ]);
  }

  async function newModel(): Promise<void> {
    const created = await props.handles.createSheet("New model", null, { kind: "model" });
    await props.sheets.setSheetModels(props.summary.id, [
      ...(props.summary.models ?? []),
      created.id,
    ]);
    props.sheets.select(created.id);
  }

  const menu = (): MenuItem[] => [
    {
      label: props.view.view().properties ? "Hide fields" : "Show fields",
      onSelect: props.view.toggleProperties,
    },
    { label: props.view.view().raw ? "Rendered" : "Raw", onSelect: toggleRaw },
    ...(props.summary.kind === "model"
      ? []
      : [
          { separator: true as const },
          {
            label: "Save fields as model",
            disabled: fieldKeys(own().fields, own().meta).length === 0,
            onSelect: () => void saveAsModel(),
          },
        ]),
  ];

  return (
    <Panel id="sheet" title={props.summary.title} width={null} menu={menu()}>
      {/* The header: the sheet's name against the reading edge, what it is at the far end.
          One line each — the name is an input, the models scroll sideways — so a long name
          or a row of models never pushes the toolbar down. */}
      <header class="grid shrink-0 grid-cols-2 items-center gap-3 overflow-hidden px-3 pt-2 pb-1.5">
        <TitleField value={props.summary.title} onCommit={props.onRename} />
        <ModelPills
          summary={props.summary}
          models={props.sheets.models()}
          onTake={(id) =>
            void props.sheets.setSheetModels(props.summary.id, [
              ...(props.summary.models ?? []),
              id,
            ])
          }
          onDrop={(id) =>
            void props.sheets.setSheetModels(
              props.summary.id,
              (props.summary.models ?? []).filter((model) => model !== id),
            )
          }
          onOpen={(id) => props.sheets.select(id)}
          onCreate={() => void newModel()}
        />
      </header>
      <SheetToolbar
        state={state()}
        run={run}
        historyOnly={props.view.view().raw}
        trailing={
          <>
            <ViewToggle
              label="Fields"
              pressed={props.view.view().properties}
              onToggle={props.view.toggleProperties}
            >
              <ListTree size={16} aria-hidden="true" />
            </ViewToggle>
            <ViewToggle label="Raw" pressed={props.view.view().raw} onToggle={toggleRaw}>
              <FileCode size={16} aria-hidden="true" />
            </ViewToggle>
          </>
        }
      />
      {/* The body fills the panel: a sheet is a working surface, not a reading column, and the
          panel's own width is already the person's to set by dragging its gutter. */}
      <div class="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div class="flex flex-col gap-4">
          <Show when={props.view.view().properties}>
            <PropertiesBlock
              sheet={props.sheet}
              models={taken()}
              onOpenModel={(id) => props.sheets.select(id)}
            />
          </Show>
          <Show when={props.view.view().raw}>
            <section aria-label="Raw source">
              <textarea
                ref={rawInput}
                aria-label="Raw source"
                value={rawDraft()}
                wrap="off"
                spellcheck={false}
                class="block min-h-64 w-full resize-none overflow-x-auto overflow-y-hidden bg-transparent p-0 font-mono text-sm leading-relaxed text-fg outline-none"
                onInput={(event) => {
                  updateRaw(event.currentTarget.value);
                  resizeRaw(event.currentTarget);
                }}
              />
            </section>
          </Show>
          <div
            ref={mount}
            class="sheet-editor narrative-markdown text-fg"
            classList={{ hidden: props.view.view().raw }}
          />
        </div>
      </div>
    </Panel>
  );
}

/** Let the panel own vertical scrolling while raw source grows like the rendered document. */
function resizeRaw(input: HTMLTextAreaElement | undefined): void {
  if (!input) return;
  input.style.height = "0";
  input.style.height = `${Math.max(256, input.scrollHeight)}px`;
}

/** A view switch on the toolbar's right: lit while on, like a formatting button that is. */
function ViewToggle(props: {
  label: string;
  pressed: boolean;
  onToggle: () => void;
  children: JSX.Element;
}) {
  return (
    <button
      type="button"
      aria-label={props.label}
      title={props.label}
      aria-pressed={props.pressed}
      class="rounded-app p-1 transition-colors motion-reduce:transition-none"
      classList={{
        "bg-surface-raised text-accent": props.pressed,
        "text-fg-muted hover:bg-surface-raised hover:text-fg": !props.pressed,
      }}
      onClick={props.onToggle}
    >
      {props.children}
    </button>
  );
}

/** The sheet's name, in the header. One line, takes the room left over, commits on blur and Enter. */
function TitleField(props: { value: string; onCommit: (title: string) => void }) {
  const [draft, setDraft] = createSignal(props.value);
  return (
    <input
      aria-label="Sheet title"
      value={draft()}
      spellcheck={false}
      class="min-w-0 w-full bg-transparent font-narrative text-lg font-semibold text-fg outline-none placeholder:text-fg-subtle"
      placeholder="Untitled"
      onInput={(event) => setDraft(event.currentTarget.value)}
      onBlur={() => props.onCommit(draft())}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
    />
  );
}

function markKeys(schema: Schema): Record<string, Command> {
  const keys: Record<string, Command> = {};
  for (const [key, name] of [
    ["Mod-b", "strong"],
    ["Mod-i", "em"],
    ["Mod-`", "code"],
  ] as const) {
    const mark = schema.marks[name];
    if (mark) keys[key] = toggleMark(mark);
  }
  return keys;
}

/** Mod-Alt-0 for a paragraph and Mod-Alt-1..3 for headings, as most editors have it. */
function blockKeys(schema: Schema): Record<string, Command> {
  const keys: Record<string, Command> = {};
  const paragraph = schema.nodes["paragraph"];
  const heading = schema.nodes["heading"];
  if (paragraph) keys["Mod-Alt-0"] = setBlockType(paragraph);
  if (heading) {
    for (const level of [1, 2, 3]) keys[`Mod-Alt-${level}`] = setBlockType(heading, { level });
  }
  return keys;
}

/** Enter splits a list item, Tab nests it, Shift-Tab lifts it. Outside a list they fall through. */
function listKeys(schema: Schema): Record<string, Command> {
  const item = schema.nodes["list_item"];
  if (!item) return {};
  return { Enter: splitListItem(item), Tab: sinkListItem(item), "Shift-Tab": liftListItem(item) };
}

/** Inside a table only; every one of these returns false elsewhere so the next map runs. */
function tableKeys(): Record<string, Command> {
  return { Tab: goToNextCell(1), "Shift-Tab": goToNextCell(-1), Enter: enterInCell };
}

/**
 * Enter in a cell moves down the column. On the last row it adds one first, so a table grows
 * the way a list does: keep pressing Enter, keep getting rows.
 */
const enterInCell: Command = (state, dispatch, view) => {
  if (!isInTable(state)) return false;
  const rect = selectedRect(state);
  if (rect.bottom >= rect.map.height) {
    if (!view || !dispatch) return false;
    addRowAfter(view.state, view.dispatch);
    const grown = selectedRect(view.state);
    if (grown.bottom >= grown.map.height) return true;
    return moveToRow(view.state, view.dispatch, grown, grown.bottom);
  }
  return moveToRow(state, dispatch, rect, rect.bottom);
};

function moveToRow(
  state: EditorState,
  dispatch: ((tr: Transaction) => void) | undefined,
  rect: ReturnType<typeof selectedRect>,
  row: number,
): boolean {
  const target = rect.map.map[row * rect.map.width + rect.left];
  if (target === undefined || !dispatch) return false;
  const $cell = state.doc.resolve(rect.tableStart + target + 1);
  dispatch(state.tr.setSelection(TextSelection.near($cell)).scrollIntoView());
  return true;
}

/** The Markdown prefixes that turn a line into a block as they are typed. */
function markdownShortcuts(schema: Schema): Plugin {
  const rules: InputRule[] = [];
  const heading = schema.nodes["heading"];
  const bullets = schema.nodes["bullet_list"];
  const numbers = schema.nodes["ordered_list"];
  const quote = schema.nodes["blockquote"];
  const code = schema.nodes["code_block"];
  if (heading) {
    rules.push(
      textblockTypeInputRule(/^(#{1,3})\s$/, heading, (match) => ({ level: match[1]?.length })),
    );
  }
  if (bullets) rules.push(wrappingInputRule(/^\s*[-*+]\s$/, bullets));
  if (numbers) rules.push(wrappingInputRule(/^\d+\.\s$/, numbers));
  if (quote) rules.push(wrappingInputRule(/^\s*>\s$/, quote));
  if (code) rules.push(textblockTypeInputRule(/^```$/, code));
  return inputRules({ rules });
}
