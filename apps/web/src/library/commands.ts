import AtSign from "lucide-solid/icons/at-sign";
import Braces from "lucide-solid/icons/braces";
import Heading1 from "lucide-solid/icons/heading-1";
import Heading2 from "lucide-solid/icons/heading-2";
import Heading3 from "lucide-solid/icons/heading-3";
import List from "lucide-solid/icons/list";
import ListOrdered from "lucide-solid/icons/list-ordered";
import Pilcrow from "lucide-solid/icons/pilcrow";
import SquareCode from "lucide-solid/icons/square-code";
import Table from "lucide-solid/icons/table";
import TextQuote from "lucide-solid/icons/text-quote";
import { setBlockType, wrapIn } from "prosemirror-commands";
import type { Schema } from "prosemirror-model";
import { wrapInList } from "prosemirror-schema-list";
import { type Command, TextSelection } from "prosemirror-state";
import { isInTable } from "prosemirror-tables";
import type { JSX } from "solid-js";

/**
 * What a sheet's body can be told to do, in one place, so the toolbar and the `/` menu can
 * never drift apart about what a heading is.
 */

type Icon = (props: { size?: number; class?: string; "aria-hidden"?: "true" }) => JSX.Element;

/** One line of the `/` menu. */
export type SlashCommand = {
  id: string;
  label: string;
  /** The right-hand column: the syntax that does the same thing, where there is one. */
  hint: string;
  /** Other words that should find it. The label is always searched; these are extra. */
  keywords: readonly string[];
  icon: Icon;
  command: Command;
};

/**
 * Types a trigger for the caret, adding the space the trigger needs to be a trigger. `@` and
 * `/` only fire at the start of a block or after whitespace, so a button that types one
 * mid-word has to make the room itself or nothing opens.
 */
export function typeTrigger(trigger: string, needsRoom = true): Command {
  return (state, dispatch) => {
    const { $from, empty } = state.selection;
    if (!empty || !$from.parent.isTextblock) return false;
    if (!dispatch) return true;
    const before = $from.parent.textBetween(0, $from.parentOffset, undefined, "￼");
    const room = needsRoom && before !== "" && !/\s$/.test(before);
    dispatch(state.tr.insertText(room ? ` ${trigger}` : trigger).scrollIntoView());
    return true;
  };
}

/**
 * A 3×3 table with a header row, with the caret left in its first cell. A paragraph follows
 * it when nothing else does: a table that ends the document has no way out below it, and
 * Enter on its last row grows it rather than leaving.
 */
export function insertTable(schema: Schema): Command {
  const table = schema.nodes["table"];
  const row = schema.nodes["table_row"];
  const cell = schema.nodes["table_cell"];
  const header = schema.nodes["table_header"];
  const paragraph = schema.nodes["paragraph"];
  if (!table || !row || !cell || !header || !paragraph) return () => false;
  return (state, dispatch) => {
    if (isInTable(state)) return false;
    if (!dispatch) return true;
    const rows = [0, 1, 2].map((r) =>
      row.create(
        null,
        [0, 1, 2].map(() => (r === 0 ? header : cell).create()),
      ),
    );
    const node = table.create(null, rows);
    const tr = state.tr.replaceSelectionWith(node);
    // The selection lands after the table; the first cell's content starts three tokens in.
    const after = tr.selection.from;
    if (tr.doc.resolve(after).nodeAfter === null) tr.insert(after, paragraph.create());
    const first = after - node.nodeSize + 3;
    dispatch(tr.setSelection(TextSelection.near(tr.doc.resolve(first))).scrollIntoView());
    return true;
  };
}

/**
 * The `/` menu, in the order it reads. Blocks first, because that is what the key is for in
 * every editor that has one; the two chips last, because they are what this editor has that
 * those do not.
 *
 * A slash command sets rather than toggles. The toolbar's block buttons clear back to a
 * paragraph when they are already lit, which is right for a button that shows its own state;
 * a menu line that has just been searched for and chosen means "make it this".
 */
export function slashCommands(schema: Schema): readonly SlashCommand[] {
  const found: SlashCommand[] = [];
  const paragraph = schema.nodes["paragraph"];
  const heading = schema.nodes["heading"];
  const bullets = schema.nodes["bullet_list"];
  const numbers = schema.nodes["ordered_list"];
  const quote = schema.nodes["blockquote"];
  const codeBlock = schema.nodes["code_block"];

  if (paragraph) {
    found.push({
      id: "paragraph",
      label: "Text",
      hint: "",
      keywords: ["paragraph", "plain", "body"],
      icon: Pilcrow,
      command: setBlockType(paragraph),
    });
  }
  if (heading) {
    for (const [level, icon] of [
      [1, Heading1],
      [2, Heading2],
      [3, Heading3],
    ] as const) {
      found.push({
        id: `heading-${level}`,
        label: `Heading ${level}`,
        hint: `${"#".repeat(level)} `,
        keywords: ["title", `h${level}`],
        icon,
        command: setBlockType(heading, { level }),
      });
    }
  }
  if (bullets) {
    found.push({
      id: "bullet-list",
      label: "Bullet list",
      hint: "- ",
      keywords: ["unordered", "dash", "points"],
      icon: List,
      command: wrapInList(bullets),
    });
  }
  if (numbers) {
    found.push({
      id: "ordered-list",
      label: "Numbered list",
      hint: "1. ",
      keywords: ["ordered", "steps"],
      icon: ListOrdered,
      command: wrapInList(numbers),
    });
  }
  if (quote) {
    found.push({
      id: "quote",
      label: "Quote",
      hint: "> ",
      keywords: ["blockquote", "citation"],
      icon: TextQuote,
      command: wrapIn(quote),
    });
  }
  if (codeBlock) {
    found.push({
      id: "code-block",
      label: "Code block",
      hint: "```",
      keywords: ["pre", "monospace", "snippet"],
      icon: SquareCode,
      command: setBlockType(codeBlock),
    });
  }
  if (schema.nodes["table"]) {
    found.push({
      id: "table",
      label: "Table",
      hint: "3×3",
      keywords: ["grid", "rows", "columns"],
      icon: Table,
      command: insertTable(schema),
    });
  }
  // No divider. `horizontal_rule` is in the schema but has no `automerge` mapping
  // (library/schema.ts), so the binding has nothing to store one as — it would go in and not
  // come back. The menu offers it the day the node is mapped, and not before.
  // The chips type their own trigger rather than doing the work here, so the list that opens
  // next is the same list the keyboard would have opened, and the menu teaches the syntax.
  if (schema.nodes["ref"]) {
    found.push({
      id: "reference",
      label: "Reference a sheet",
      hint: "@",
      keywords: ["link", "mention", "sheet"],
      icon: AtSign,
      command: typeTrigger("@"),
    });
  }
  if (schema.nodes["field"]) {
    found.push({
      id: "field",
      label: "Place a field",
      hint: "{{",
      keywords: ["property", "attribute", "value"],
      icon: Braces,
      command: typeTrigger("{{", false),
    });
  }
  return found;
}
