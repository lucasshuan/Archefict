import type { SheetHandles } from "@archefict/crdt";
import { init } from "@automerge/prosemirror";
import { baseKeymap, lift, setBlockType, toggleMark, wrapIn } from "prosemirror-commands";
import { history, redo, undo } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import type { Schema } from "prosemirror-model";
import { liftListItem, sinkListItem, splitListItem, wrapInList } from "prosemirror-schema-list";
import { type Command, EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import "prosemirror-view/style/prosemirror.css";
import { createSignal, onCleanup, onMount } from "solid-js";
import type { MenuItem } from "../components/Menu.tsx";
import { Panel } from "../components/Panel.tsx";

/**
 * A sheet's body: ProseMirror over the Automerge document, through @automerge/prosemirror.
 * Automerge stays canonical; the editor is a view of it that writes back as it goes, so a
 * second tab follows every keystroke (Phase 0 spike). The panel's `⋯` carries the block
 * commands, which is why there is no toolbar: the bar is the toolbar.
 *
 * Pasted images are dropped for now. The image block exists in the schema, but a pasted
 * `<img>` would load an arbitrary URL; images come from local assets later in Slice 1.
 */
export function SheetEditor(props: {
  sheet: SheetHandles;
  title: string;
  onRename: (title: string) => void;
}) {
  let mount: HTMLDivElement | undefined;
  const [view, setView] = createSignal<EditorView | null>(null);

  onMount(() => {
    if (!mount) return;
    const { schema, pmDoc, plugin } = init(props.sheet.doc, ["body"]);
    const state = EditorState.create({
      schema,
      doc: pmDoc,
      plugins: [
        keymap(listKeys(schema)),
        keymap({ ...markKeys(schema), "Mod-z": undo, "Mod-y": redo, "Mod-Shift-z": redo }),
        keymap(baseKeymap),
        history(),
        plugin,
      ],
    });
    setView(
      new EditorView(mount, {
        state,
        transformPastedHTML: (html) => html.replace(/<img\b[^>]*>/gi, ""),
      }),
    );
  });
  onCleanup(() => view()?.destroy());

  function run(command: Command): void {
    const current = view();
    if (!current) return;
    command(current.state, current.dispatch, current);
    current.focus();
  }

  const menu = (): MenuItem[] => {
    const current = view();
    return current ? blockItems(current.state.schema, run) : [];
  };

  return (
    <Panel title={props.title} class="flex-1 bg-bg" menu={menu()}>
      <div class="min-h-0 flex-1 overflow-y-auto px-4 py-5">
        <div class="mx-auto flex max-w-page flex-col gap-4">
          <TitleField value={props.title} onCommit={props.onRename} />
          <div ref={mount} class="sheet-editor narrative-markdown text-fg" />
        </div>
      </div>
    </Panel>
  );
}

/** The sheet's name, large, at the top of its body. Commits on blur and Enter. */
function TitleField(props: { value: string; onCommit: (title: string) => void }) {
  const [draft, setDraft] = createSignal(props.value);
  return (
    <input
      aria-label="Sheet title"
      value={draft()}
      spellcheck={false}
      class="w-full bg-transparent font-narrative text-2xl font-semibold text-fg outline-none placeholder:text-fg-subtle"
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

/** Enter splits a list item, Tab nests it, Shift-Tab lifts it. Outside a list they fall through. */
function listKeys(schema: Schema): Record<string, Command> {
  const item = schema.nodes["list_item"];
  if (!item) return {};
  return { Enter: splitListItem(item), Tab: sinkListItem(item), "Shift-Tab": liftListItem(item) };
}

/** The block commands, for the panel menu. Only the ones the schema actually has. */
function blockItems(schema: Schema, run: (command: Command) => void): MenuItem[] {
  const items: MenuItem[] = [];
  const paragraph = schema.nodes["paragraph"];
  const heading = schema.nodes["heading"];
  const quote = schema.nodes["blockquote"];
  const bullets = schema.nodes["bullet_list"];
  const numbers = schema.nodes["ordered_list"];
  const code = schema.nodes["code_block"];

  if (paragraph) items.push({ label: "Paragraph", onSelect: () => run(setBlockType(paragraph)) });
  if (heading) {
    for (const level of [1, 2, 3]) {
      items.push({
        label: `Heading ${level}`,
        onSelect: () => run(setBlockType(heading, { level })),
      });
    }
  }
  items.push({ separator: true });
  if (bullets) items.push({ label: "Bullet list", onSelect: () => run(wrapInList(bullets)) });
  if (numbers) items.push({ label: "Numbered list", onSelect: () => run(wrapInList(numbers)) });
  if (quote) items.push({ label: "Quote", onSelect: () => run(wrapIn(quote)) });
  if (code) items.push({ label: "Code block", onSelect: () => run(setBlockType(code)) });
  items.push({ separator: true });
  items.push({ label: "Lift out", onSelect: () => run(lift) });
  return items;
}
