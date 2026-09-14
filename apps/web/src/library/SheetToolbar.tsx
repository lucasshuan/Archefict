import AtSign from "lucide-solid/icons/at-sign";
import Bold from "lucide-solid/icons/bold";
import Code from "lucide-solid/icons/code";
import Columns3 from "lucide-solid/icons/columns-3";
import Heading1 from "lucide-solid/icons/heading-1";
import Heading2 from "lucide-solid/icons/heading-2";
import Heading3 from "lucide-solid/icons/heading-3";
import Italic from "lucide-solid/icons/italic";
import List from "lucide-solid/icons/list";
import ListOrdered from "lucide-solid/icons/list-ordered";
import Outdent from "lucide-solid/icons/outdent";
import PanelTop from "lucide-solid/icons/panel-top";
import Pilcrow from "lucide-solid/icons/pilcrow";
import Redo from "lucide-solid/icons/redo-2";
import Rows3 from "lucide-solid/icons/rows-3";
import SquareCode from "lucide-solid/icons/square-code";
import Table from "lucide-solid/icons/table";
import TableColumnsSplit from "lucide-solid/icons/table-columns-split";
import TableRowsSplit from "lucide-solid/icons/table-rows-split";
import TextQuote from "lucide-solid/icons/text-quote";
import Trash2 from "lucide-solid/icons/trash-2";
import Undo from "lucide-solid/icons/undo-2";
import { lift, setBlockType, toggleMark, wrapIn } from "prosemirror-commands";
import { redo, undo } from "prosemirror-history";
import type { Attrs, MarkType, NodeType, Schema } from "prosemirror-model";
import { liftListItem, wrapInList } from "prosemirror-schema-list";
import type { Command, EditorState } from "prosemirror-state";
import {
  addColumnAfter,
  addRowAfter,
  deleteColumn,
  deleteRow,
  deleteTable,
  isInTable,
  toggleHeaderRow,
} from "prosemirror-tables";
import { createMemo, For, type JSX, Show } from "solid-js";
import { insertTable, typeTrigger } from "./commands.ts";

type Icon = (props: { size?: number; "aria-hidden"?: "true" }) => JSX.Element;

type Tool = {
  label: string;
  icon: Icon;
  shortcut?: string;
  /** What pressing it does, and — unless `enabled` says otherwise — whether it can be pressed. */
  command: Command;
  /** Lit while the selection already has it. Absent for one-shot actions such as undo. */
  active?: (state: EditorState) => boolean;
  enabled?: (state: EditorState) => boolean;
  /** Shown only where it applies: the table tools appear inside a table and nowhere else. */
  visible?: (state: EditorState) => boolean;
};

const MOD =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";

/**
 * The formatting toolbar of a sheet: a strip under the panel bar, over the body, that stays
 * put while the body scrolls. Every button reflects the selection — lit when the selection
 * already has that formatting, dimmed when the command cannot apply — and pressing a lit
 * block button takes the block back to a paragraph, so one button both sets and clears.
 *
 * Buttons keep the editor's selection: a press does not move focus into the toolbar, and the
 * command hands focus straight back. Arrow keys walk the buttons for a keyboard.
 */
export function SheetToolbar(props: {
  state: EditorState | null;
  run: (command: Command) => void;
  /** Raw source has its own syntax, so only its undo and redo controls remain relevant. */
  historyOnly?: boolean;
  /** Pushed to the right end: the view switches, which are about the sheet, not the text. */
  trailing?: JSX.Element;
}) {
  let root: HTMLDivElement | undefined;

  // The schema never changes for a mounted editor, so the tools are built once. The memo in
  // between is what makes that true: it follows every state change but yields the same
  // schema object, so the groups memo downstream never reruns on a keystroke.
  const schema = createMemo(() => props.state?.schema ?? null);
  const groups = createMemo(() => {
    const current = schema();
    return current ? buildGroups(current) : [];
  });
  const visible = createMemo(() => {
    const current = props.state;
    if (!current) return [];
    const relevant = props.historyOnly ? groups().slice(0, 1) : groups();
    return relevant
      .map((group) => group.filter((tool) => tool.visible?.(current) ?? true))
      .filter((group) => group.length > 0);
  });

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    const buttons = [...(root?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [])];
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) return;
    event.preventDefault();
    const step = event.key === "ArrowRight" ? 1 : -1;
    buttons[(at + step + buttons.length) % buttons.length]?.focus();
  }

  return (
    <Show when={props.state}>
      {(state) => (
        <div
          ref={root}
          role="toolbar"
          aria-label="Formatting"
          class="flex shrink-0 flex-wrap items-center gap-0.5 px-2 py-1"
          onKeyDown={onKeyDown}
        >
          <For each={visible()}>
            {(group, index) => (
              <>
                <Show when={index() > 0}>
                  <span aria-hidden="true" class="mx-1 h-4 w-px bg-border" />
                </Show>
                <For each={group}>
                  {(tool) => <ToolButton tool={tool} state={state()} run={props.run} />}
                </For>
              </>
            )}
          </For>
          <Show when={props.trailing}>
            <span class="ml-auto flex items-center gap-0.5 pl-2">{props.trailing}</span>
          </Show>
        </div>
      )}
    </Show>
  );
}

function ToolButton(props: { tool: Tool; state: EditorState; run: (command: Command) => void }) {
  const active = () => props.tool.active?.(props.state) ?? false;
  const enabled = () =>
    props.tool.enabled ? props.tool.enabled(props.state) : props.tool.command(props.state);
  const title = () =>
    props.tool.shortcut ? `${props.tool.label} (${props.tool.shortcut})` : props.tool.label;
  return (
    <button
      type="button"
      aria-label={props.tool.label}
      title={title()}
      aria-pressed={props.tool.active ? active() : undefined}
      disabled={!enabled()}
      class="rounded-app p-1 transition-colors disabled:pointer-events-none disabled:opacity-40 motion-reduce:transition-none"
      classList={{
        "bg-surface-raised text-accent": active(),
        "text-fg-muted hover:bg-surface-raised hover:text-fg": !active(),
      }}
      onPointerDown={(event) => event.preventDefault()}
      onClick={() => props.run(props.tool.command)}
    >
      <props.tool.icon size={16} aria-hidden="true" />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Selection queries and toggling commands. Only what the toolbar needs.
// ---------------------------------------------------------------------------

function markActive(state: EditorState, type: MarkType): boolean {
  const { from, $from, to, empty } = state.selection;
  if (empty) return type.isInSet(state.storedMarks ?? $from.marks()) !== undefined;
  return state.doc.rangeHasMark(from, to, type);
}

/**
 * Not `hasMarkup`: the Automerge adapter puts `isAmgBlock` and `unknownAttrs` on every node,
 * so a deep compare against `{ level: 2 }` never matches. Only the attrs asked about count.
 */
function blockIs(state: EditorState, type: NodeType, attrs?: Attrs): boolean {
  const { parent } = state.selection.$from;
  if (parent.type !== type) return false;
  return Object.entries(attrs ?? {}).every(([key, value]) => parent.attrs[key] === value);
}

function wrappedIn(state: EditorState, type: NodeType): boolean {
  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    if ($from.node(depth).type === type) return true;
  }
  return false;
}

/** Sets the block type, or back to a paragraph when the block already is that type. */
function toggleBlock(type: NodeType, paragraph: NodeType, attrs?: Attrs): Command {
  return (state, dispatch, view) =>
    (blockIs(state, type, attrs) ? setBlockType(paragraph) : setBlockType(type, attrs))(
      state,
      dispatch,
      view,
    );
}

/** Wraps in the type, or lifts out of it when the selection already sits inside one. */
function toggleWrap(type: NodeType, wrap: Command, unwrap: Command): Command {
  return (state, dispatch, view) => (wrappedIn(state, type) ? unwrap : wrap)(state, dispatch, view);
}

/**
 * The strip, group by group. Every command comes from `commands.ts` where one is shared with
 * the `/` menu, so the two can never disagree about what a heading is.
 */
function buildGroups(schema: Schema): Tool[][] {
  const groups: Tool[][] = [];
  const key = (k: string) => `${MOD}+${k}`;

  groups.push([
    { label: "Undo", icon: Undo, shortcut: key("Z"), command: undo },
    { label: "Redo", icon: Redo, shortcut: key("Y"), command: redo },
  ]);

  const paragraph = schema.nodes["paragraph"];
  const heading = schema.nodes["heading"];
  if (paragraph) {
    const blocks: Tool[] = [
      {
        label: "Paragraph",
        icon: Pilcrow,
        shortcut: key("Alt+0"),
        command: setBlockType(paragraph),
        active: (s) => blockIs(s, paragraph),
      },
    ];
    if (heading) {
      const icons = [Heading1, Heading2, Heading3] as const;
      icons.forEach((icon, index) => {
        const level = index + 1;
        blocks.push({
          label: `Heading ${level}`,
          icon,
          shortcut: key(`Alt+${level}`),
          command: toggleBlock(heading, paragraph, { level }),
          active: (s) => blockIs(s, heading, { level }),
        });
      });
    }
    groups.push(blocks);
  }

  const marks: Tool[] = [];
  const strong = schema.marks["strong"];
  const em = schema.marks["em"];
  const code = schema.marks["code"];
  if (strong) {
    marks.push({
      label: "Bold",
      icon: Bold,
      shortcut: key("B"),
      command: toggleMark(strong),
      active: (s) => markActive(s, strong),
    });
  }
  if (em) {
    marks.push({
      label: "Italic",
      icon: Italic,
      shortcut: key("I"),
      command: toggleMark(em),
      active: (s) => markActive(s, em),
    });
  }
  if (code) {
    marks.push({
      label: "Code",
      icon: Code,
      shortcut: key("`"),
      command: toggleMark(code),
      active: (s) => markActive(s, code),
    });
  }
  if (marks.length > 0) groups.push(marks);

  const structure: Tool[] = [];
  const bullets = schema.nodes["bullet_list"];
  const numbers = schema.nodes["ordered_list"];
  const item = schema.nodes["list_item"];
  const quote = schema.nodes["blockquote"];
  const codeBlock = schema.nodes["code_block"];
  if (bullets && item) {
    structure.push({
      label: "Bullet list",
      icon: List,
      command: toggleWrap(bullets, wrapInList(bullets), liftListItem(item)),
      active: (s) => wrappedIn(s, bullets),
    });
  }
  if (numbers && item) {
    structure.push({
      label: "Numbered list",
      icon: ListOrdered,
      command: toggleWrap(numbers, wrapInList(numbers), liftListItem(item)),
      active: (s) => wrappedIn(s, numbers),
    });
  }
  if (quote) {
    structure.push({
      label: "Quote",
      icon: TextQuote,
      command: toggleWrap(quote, wrapIn(quote), lift),
      active: (s) => wrappedIn(s, quote),
    });
  }
  if (codeBlock && paragraph) {
    structure.push({
      label: "Code block",
      icon: SquareCode,
      command: toggleBlock(codeBlock, paragraph),
      active: (s) => blockIs(s, codeBlock),
    });
  }
  if (schema.nodes["table"]) {
    structure.push({
      label: "Table",
      icon: Table,
      command: insertTable(schema),
      visible: (s) => !isInTable(s),
    });
  }
  if (structure.length > 0) groups.push(structure);

  groups.push([{ label: "Lift out", icon: Outdent, command: lift }]);

  // One chip trigger, not two. The button types `@`, so the popup that opens is the one the
  // keyboard would have opened and the toolbar teaches the syntax rather than hiding it.
  // Placing a field left the toolbar on Sep 14, 2026 and lives in the `/` menu: `{{` is a
  // thing you reach for mid-sentence, and a strip of icons above the text is not where a hand
  // already in the middle of a line goes.
  if (schema.nodes["ref"]) {
    groups.push([{ label: "Reference a sheet", icon: AtSign, command: typeTrigger("@") }]);
  }

  if (schema.nodes["table"]) {
    const inTable = (s: EditorState) => isInTable(s);
    groups.push([
      { label: "Add row below", icon: Rows3, command: addRowAfter, visible: inTable },
      { label: "Add column after", icon: Columns3, command: addColumnAfter, visible: inTable },
      { label: "Delete row", icon: TableRowsSplit, command: deleteRow, visible: inTable },
      { label: "Delete column", icon: TableColumnsSplit, command: deleteColumn, visible: inTable },
      { label: "Header row", icon: PanelTop, command: toggleHeaderRow, visible: inTable },
      { label: "Delete table", icon: Trash2, command: deleteTable, visible: inTable },
    ]);
  }

  return groups;
}
